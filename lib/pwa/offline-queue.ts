/**
 * Offline send-queue interface (ROADMAP Task 0.3). Counsellors and field staff
 * on metered data are first-class: a booking, note, or message created offline is
 * **queued** with an honest "will send when online" state, then synced on
 * reconnect with a conflict re-check. Phase 11 implements durable storage
 * (IndexedDB) + sync; this defines the seam so the Phase-8 queued-state UI has a
 * contract to render against now.
 */
export type QueuedKind = "booking" | "reschedule" | "note" | "message";

export interface QueuedItem<T = unknown> {
  id: string;
  kind: QueuedKind;
  payload: T;
  createdAt: string;
  /** queued → syncing → sent | conflict | failed. Never a fake "sent". */
  status: "queued" | "syncing" | "sent" | "conflict" | "failed";
  attempts: number;
}

export interface OfflineQueue {
  enqueue<T>(kind: QueuedKind, payload: T): Promise<QueuedItem<T>>;
  list(): Promise<QueuedItem[]>;
  /** Attempt to flush queued items; returns what changed. */
  sync(): Promise<{ sent: number; conflicts: number; failed: number }>;
  pending(): Promise<number>;
}

/**
 * Part-A stub: keeps items in memory so the UI can show queued counts in the
 * demo. It deliberately never claims to have sent anything (Cost/Honesty Rules).
 */
class MemoryOfflineQueue implements OfflineQueue {
  private items: QueuedItem[] = [];
  private seq = 0;

  async enqueue<T>(kind: QueuedKind, payload: T): Promise<QueuedItem<T>> {
    const item: QueuedItem<T> = {
      id: `q_${++this.seq}`,
      kind,
      payload,
      createdAt: new Date().toISOString(),
      status: "queued",
      attempts: 0,
    };
    this.items.push(item as QueuedItem);
    return item;
  }

  async list(): Promise<QueuedItem[]> {
    return [...this.items];
  }

  async sync() {
    // Inert until Phase 11 — honest no-op.
    return { sent: 0, conflicts: 0, failed: 0 };
  }

  async pending(): Promise<number> {
    return this.items.filter((i) => i.status === "queued").length;
  }
}

export const offlineQueue: OfflineQueue = new MemoryOfflineQueue();
