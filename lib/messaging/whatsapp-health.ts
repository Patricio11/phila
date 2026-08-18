/**
 * Phase 34.3 - the org's WhatsApp number as Meta sees it. Pure (no I/O):
 * parse Meta's health webhooks, derive the send throttle from quality, and
 * say in plain English what we're doing about it. Modelled on the pattern
 * that worked in Thola (quality-scaled sends, pause on restriction).
 */
export type WaQuality = "green" | "yellow" | "red" | "unknown";
export type WaStatus = "connected" | "flagged" | "restricted" | "banned";

export interface NumberHealth {
  quality: WaQuality;
  status: WaStatus;
  /** Meta's messaging-limit tier as a per-day number; -1 = unknown / unlimited. */
  dailyLimit: number;
  tierLabel: string | null;
  displayPhone: string | null;
  flaggedAt: string | null;
  lastEventAt: string | null;
}

export const HEALTHY: NumberHealth = { quality: "unknown", status: "connected", dailyLimit: -1, tierLabel: null, displayPhone: null, flaggedAt: null, lastEventAt: null };

/** Restricted / banned = Meta won't carry business-initiated sends; we stop trying. */
export function sendsPaused(status: WaStatus): boolean {
  return status === "restricted" || status === "banned";
}

/** Meta's tier vocabulary -> messages per 24h. */
export function tierToLimit(tier: string | null | undefined): number {
  switch ((tier ?? "").toUpperCase()) {
    case "TIER_50": return 50;
    case "TIER_250": return 250;
    case "TIER_1K": return 1000;
    case "TIER_10K": return 10000;
    case "TIER_100K": return 100000;
    case "TIER_UNLIMITED": return -1;
    default: return -1;
  }
}

/**
 * The per-minute send ceiling scaled by quality: red -> a quarter, yellow or
 * flagged -> half, green -> the base. Never below 5/min so a practice can
 * still reach the client who matters right now.
 */
export function effectiveLimit(h: Pick<NumberHealth, "quality" | "status">, basePerMinute: number): number {
  let n = basePerMinute;
  if (h.quality === "red") n = Math.floor(basePerMinute / 4);
  else if (h.quality === "yellow" || h.status === "flagged") n = Math.floor(basePerMinute / 2);
  return Math.max(5, n);
}

/** Plain-English "what's happening and what we're doing" per state. */
export function statusGuidance(h: Pick<NumberHealth, "quality" | "status">): string | null {
  if (h.status === "banned") return "Meta has disabled this number for messaging. Nothing sends until it's restored - contact Meta support from your WhatsApp Manager. Clients still get SMS / email if those are on.";
  if (h.status === "restricted") return "Meta has restricted this number, so we've paused WhatsApp sends to protect it. Reminders fall back to SMS / email if those are on. Restrictions usually lift within a few days.";
  if (h.status === "flagged") return "Quality dropped, so Meta has put this number on a short probation. We're easing off the send rate; keep messages expected and useful and it usually recovers in about 7 days.";
  if (h.quality === "red") return "Meta rates this number's quality LOW - people are blocking or reporting messages. We've cut the send rate to a quarter to protect the number.";
  if (h.quality === "yellow") return "Meta rates this number's quality MEDIUM. We're sending at half speed while it recovers.";
  return null;
}

/** Merge a Meta event into the current health, stamping flaggedAt on entry to a bad state. */
export function mergeHealth(cur: NumberHealth, patch: Partial<NumberHealth>, now: Date): NumberHealth {
  const next: NumberHealth = { ...cur, ...patch, lastEventAt: now.toISOString() };
  const wasBad = cur.status !== "connected" || cur.quality === "red";
  const isBad = next.status !== "connected" || next.quality === "red";
  if (isBad && !wasBad) next.flaggedAt = now.toISOString();
  if (!isBad) next.flaggedAt = null;
  return next;
}

/**
 * Meta's `phone_number_quality_update` / `account_update` webhook values.
 * Returns the patch to apply, or null when the change isn't a health event.
 */
export function parseHealthEvent(field: string | undefined, value: Record<string, unknown> | undefined): Partial<NumberHealth> | null {
  if (!value) return null;
  const displayPhone = typeof value.display_phone_number === "string" ? value.display_phone_number : undefined;
  if (field === "phone_number_quality_update") {
    const patch: Partial<NumberHealth> = {};
    if (displayPhone) patch.displayPhone = displayPhone;
    const q = String(value.current_quality_score ?? value.quality_rating ?? "").toUpperCase();
    if (q === "GREEN" || q === "HIGH") patch.quality = "green";
    else if (q === "YELLOW" || q === "MEDIUM") patch.quality = "yellow";
    else if (q === "RED" || q === "LOW") patch.quality = "red";
    const tier = (value.current_limit ?? value.messaging_limit_tier) as string | undefined;
    if (tier) { patch.tierLabel = String(tier); patch.dailyLimit = tierToLimit(String(tier)); }
    const ev = String(value.event ?? "").toUpperCase();
    if (ev === "FLAGGED") patch.status = "flagged";
    else if (ev === "UNFLAGGED" || ev === "ONBOARDING") patch.status = "connected";
    return patch;
  }
  if (field === "account_update") {
    const patch: Partial<NumberHealth> = {};
    if (displayPhone) patch.displayPhone = displayPhone;
    const ev = String(value.event ?? "").toUpperCase();
    if (ev.includes("BAN") || ev === "ACCOUNT_DELETED") patch.status = "banned";
    else if (ev.includes("RESTRICT") || ev === "DISABLED_UPDATE") patch.status = "restricted";
    else if (ev.includes("RESTORE") || ev === "VERIFIED_ACCOUNT") patch.status = "connected";
    else return null;
    return patch;
  }
  return null;
}
