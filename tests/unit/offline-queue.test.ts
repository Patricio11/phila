import { describe, it, expect, beforeEach } from "vitest";
import { offlineQueue, processQueue, type Dispatch } from "@/lib/pwa/offline-queue";

// In Node there's no IndexedDB, so the queue uses its in-memory fallback  same API.
beforeEach(async () => {
  await offlineQueue.clear();
});

describe("offline send-queue", () => {
  it("enqueues durably and counts pending", async () => {
    await offlineQueue.enqueue("booking", { a: 1 }, "b1");
    await offlineQueue.enqueue("reschedule", { b: 2 }, "r1");
    expect(await offlineQueue.pending()).toBe(2);
  });

  it("processQueue removes sent, keeps conflicts, marks unhandled kinds failed", async () => {
    await offlineQueue.enqueue("booking", { conflict: false }, "sent-one");
    await offlineQueue.enqueue("booking", { conflict: true }, "conflict-one");
    await offlineQueue.enqueue("reschedule", {}, "no-handler"); // no reschedule handler below

    const dispatch: Dispatch = {
      booking: async (p) => ((p as { conflict: boolean }).conflict ? { ok: false, conflict: true, error: "taken" } : { ok: true }),
    };
    const res = await processQueue(offlineQueue, dispatch);
    expect(res).toEqual({ sent: 1, conflicts: 1, failed: 1 });

    const items = await offlineQueue.list();
    expect(items.find((i) => i.label === "sent-one")).toBeUndefined(); // removed on success
    expect(items.find((i) => i.label === "conflict-one")?.status).toBe("conflict");
    expect(items.find((i) => i.label === "no-handler")?.status).toBe("failed");
  });

  it("retries a failed item on the next run and clears it when it succeeds", async () => {
    await offlineQueue.enqueue("booking", {}, "flaky");
    let firstTry = true;
    const dispatch: Dispatch = {
      booking: async () => {
        if (firstTry) { firstTry = false; return { ok: false, error: "network" }; }
        return { ok: true };
      },
    };
    expect((await processQueue(offlineQueue, dispatch)).failed).toBe(1);
    expect((await offlineQueue.list())[0]!.status).toBe("failed");

    const second = await processQueue(offlineQueue, dispatch); // failed items are retried
    expect(second.sent).toBe(1);
    expect(await offlineQueue.pending()).toBe(0);
  });

  it("does NOT retry a conflict (it needs the user, not a replay)", async () => {
    await offlineQueue.enqueue("booking", {}, "clash");
    const dispatch: Dispatch = { booking: async () => ({ ok: false, conflict: true, error: "taken" }) };
    await processQueue(offlineQueue, dispatch);
    // second pass skips conflicts (only queued/failed are retried)
    const res = await processQueue(offlineQueue, dispatch);
    expect(res).toEqual({ sent: 0, conflicts: 0, failed: 0 });
    expect((await offlineQueue.list())[0]!.status).toBe("conflict");
  });
});
