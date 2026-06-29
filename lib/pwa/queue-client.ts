"use client";

import { offlineQueue, processQueue, type Dispatch, type QueuedItem } from "@/lib/pwa/offline-queue";
import { submitBooking } from "@/app/o/[slug]/book/actions";
import { rescheduleAppointment } from "@/app/app/appointments/actions";
import { SLOT_TAKEN_MESSAGE } from "@/lib/scheduling/messages";

const CHANGED = "phila-queue-changed";

/** Broadcast a queue change so the indicator re-reads (across components). */
export function notifyQueueChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
}
export function onQueueChanged(fn: () => void): () => void {
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
}

export async function enqueueBooking(payload: Parameters<typeof submitBooking>[0], label: string): Promise<QueuedItem> {
  const item = await offlineQueue.enqueue("booking", payload, label);
  notifyQueueChanged();
  return item;
}
export async function enqueueReschedule(payload: Parameters<typeof rescheduleAppointment>[0], label: string): Promise<QueuedItem> {
  const item = await offlineQueue.enqueue("reschedule", payload, label);
  notifyQueueChanged();
  return item;
}

const conflictResult = (r: { ok: boolean; error?: string }) => ({ ok: r.ok, conflict: !r.ok && r.error === SLOT_TAKEN_MESSAGE, error: r.ok ? undefined : r.error });

const dispatch: Dispatch = {
  booking: async (p) => conflictResult(await submitBooking(p as Parameters<typeof submitBooking>[0])),
  reschedule: async (p) => conflictResult(await rescheduleAppointment(p as Parameters<typeof rescheduleAppointment>[0])),
};

/** Replay every queued item against the server (real availability re-check). */
export async function flushQueue(): Promise<{ sent: number; conflicts: number; failed: number }> {
  const res = await processQueue(offlineQueue, dispatch);
  notifyQueueChanged();
  return res;
}
