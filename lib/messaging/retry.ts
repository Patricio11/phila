import type { TransportResult } from "@/lib/messaging/transports";

/**
 * Phase 34.3 - transient-only retry with jittered backoff (250 / 1000 / 4000 ms
 * +/- 25 %). Permanent failures (a bad number, a rejected template, 4xx) fail
 * fast; only network / 5xx / 429 / timeouts get another go. Pure decision +
 * injectable sleep so it's unit-testable.
 */
export function isTransient(detail: string | null | undefined): boolean {
  if (!detail) return false;
  return /\b(408|425|429|5\d\d)\b|timeout|timed out|network|fetch failed|ECONN|ETIMEDOUT|EAI_AGAIN|temporarily|rate.?limit|aborted/i.test(detail);
}

export interface RetryOpts {
  tries?: number;
  baseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

export function backoffMs(attempt: number, baseMs: number, rand: () => number): number {
  const base = baseMs * Math.pow(4, attempt - 1);
  const jitter = (rand() * 0.5 - 0.25) * base;
  return Math.max(0, Math.round(base + jitter));
}

/** Run a transport send with retries; returns the final result + how many attempts it took. */
export async function withRetry(send: () => Promise<TransportResult>, opts: RetryOpts = {}): Promise<{ result: TransportResult; attempts: number }> {
  const tries = opts.tries ?? 3;
  const baseMs = opts.baseMs ?? 250;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rand = opts.rand ?? Math.random;
  let attempt = 0;
  let result: TransportResult = { status: "failed", detail: "not attempted" };
  while (attempt < tries) {
    attempt += 1;
    result = await send();
    if (result.status !== "failed" || !isTransient(result.detail)) return { result, attempts: attempt };
    if (attempt < tries) await sleep(backoffMs(attempt, baseMs, rand));
  }
  return { result, attempts: attempt };
}

/** Delivery states never move backwards (an out-of-order webhook can't turn "read" into "sent"). */
const ORDER = ["queued", "sent", "delivered", "read"] as const;
export function nextDeliveryState(current: string, incoming: string): string {
  const ci = ORDER.indexOf(current as (typeof ORDER)[number]);
  const ii = ORDER.indexOf(incoming as (typeof ORDER)[number]);
  if (incoming === "failed") return ci >= ORDER.indexOf("delivered") ? current : "failed"; // a late "failed" can't undo a delivery
  if (ii < 0) return current;
  if (ci < 0) return incoming;
  return ii > ci ? incoming : current;
}

/** POPIA - a recipient never sits unmasked in an ops table. */
export function maskTarget(t: string): string {
  if (t.includes("@")) { const [a, d] = t.split("@"); return `${(a ?? "").slice(0, 1)}•••@${d}`; }
  const digits = t.replace(/\D/g, "");
  return digits.length >= 4 ? `${t.startsWith("+") ? "+" : ""}${digits.slice(0, 2)}•••${digits.slice(-2)}` : "•••";
}
