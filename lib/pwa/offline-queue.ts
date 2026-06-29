/**
 * Offline send-queue (ROADMAP Task 0.3 / Phase 11). Counsellors and field staff
 * on metered or flaky data are first-class: a booking or reschedule created
 * offline is **queued durably** (IndexedDB) with an honest "will send when
 * online" state, then replayed on reconnect — each replay hits the server's real
 * availability check (the exclusion constraints), so a slot taken while offline
 * comes back as a **conflict**, never a fake "sent".
 */
export type QueuedKind = "booking" | "reschedule" | "note" | "message";

export interface QueuedItem<T = unknown> {
  id: string;
  kind: QueuedKind;
  payload: T;
  label: string; // human summary for the queued-state UI
  createdAt: string;
  /** queued → syncing → sent | conflict | failed. Never a fake "sent". */
  status: "queued" | "syncing" | "sent" | "conflict" | "failed";
  attempts: number;
  error?: string;
}

const DB_NAME = "phila-queue";
const STORE = "items";

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

// In-memory fallback for SSR / Node (tests) where IndexedDB is absent.
const memory: QueuedItem[] = [];

let seq = 0;
function makeId(): string {
  const rnd = hasIndexedDB() && typeof crypto !== "undefined" ? crypto.randomUUID().slice(0, 8) : String(++seq);
  return `q_${Date.now().toString(36)}_${rnd}`;
}

export const offlineQueue = {
  async enqueue<T>(kind: QueuedKind, payload: T, label: string): Promise<QueuedItem<T>> {
    const item: QueuedItem<T> = { id: makeId(), kind, payload, label, createdAt: new Date().toISOString(), status: "queued", attempts: 0 };
    if (hasIndexedDB()) await tx("readwrite", (s) => s.put(item));
    else memory.push(item as QueuedItem);
    return item;
  },

  async list(): Promise<QueuedItem[]> {
    const items = hasIndexedDB() ? await tx<QueuedItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedItem[]>) : [...memory];
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async put(item: QueuedItem): Promise<void> {
    if (hasIndexedDB()) await tx("readwrite", (s) => s.put(item));
    else {
      const i = memory.findIndex((m) => m.id === item.id);
      if (i >= 0) memory[i] = item;
      else memory.push(item);
    }
  },

  async remove(id: string): Promise<void> {
    if (hasIndexedDB()) await tx("readwrite", (s) => s.delete(id));
    else {
      const i = memory.findIndex((m) => m.id === id);
      if (i >= 0) memory.splice(i, 1);
    }
  },

  async pending(): Promise<number> {
    return (await this.list()).filter((i) => i.status === "queued" || i.status === "conflict" || i.status === "failed").length;
  },

  async clear(): Promise<void> {
    if (hasIndexedDB()) await tx("readwrite", (s) => s.clear());
    else memory.length = 0;
  },
};

/** What a replay returns. `conflict` = the slot was taken while we were offline. */
export interface DispatchResult {
  ok: boolean;
  conflict?: boolean;
  error?: string;
}
export type Dispatch = Partial<Record<QueuedKind, (payload: unknown) => Promise<DispatchResult>>>;

/**
 * Replay every queued item through `dispatch`. Pure orchestration over the store
 * API so it's unit-testable: sent items are removed; conflicts/failures stay with
 * a status the UI can surface. Returns a tally.
 */
export async function processQueue(
  store: Pick<typeof offlineQueue, "list" | "put" | "remove">,
  dispatch: Dispatch,
): Promise<{ sent: number; conflicts: number; failed: number }> {
  const items = (await store.list()).filter((i) => i.status === "queued" || i.status === "failed");
  let sent = 0;
  let conflicts = 0;
  let failed = 0;
  for (const item of items) {
    const handler = dispatch[item.kind];
    if (!handler) {
      await store.put({ ...item, status: "failed", error: "No sync handler" });
      failed++;
      continue;
    }
    await store.put({ ...item, status: "syncing", attempts: item.attempts + 1 });
    let res: DispatchResult;
    try {
      res = await handler(item.payload);
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : "Sync failed" };
    }
    if (res.ok) {
      await store.remove(item.id);
      sent++;
    } else if (res.conflict) {
      await store.put({ ...item, status: "conflict", attempts: item.attempts + 1, error: res.error });
      conflicts++;
    } else {
      await store.put({ ...item, status: "failed", attempts: item.attempts + 1, error: res.error });
      failed++;
    }
  }
  return { sent, conflicts, failed };
}
