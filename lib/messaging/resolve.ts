/**
 * Pure routing decisions for the notification pipeline (unit-tested, no I/O).
 * Channel is chosen by the client's stated preference among the channels the org
 * has enabled, with a sensible fallback order. Quiet hours and opt-out are
 * enforced in the deliver chokepoint; the time maths lives here so it's testable.
 */
import type { Channel } from "@/lib/messaging/templates";

export interface ChannelAvailability {
  whatsapp: boolean; // enabled AND the org's WhatsApp number is connected
  sms: boolean;
  email: boolean;
}

const FALLBACK_ORDER: Channel[] = ["whatsapp", "sms", "email"];

/** Map the client's intake preference to a channel. "Phone call" → SMS (we text, never cold-call). */
export function preferredChannel(preferredContact: string | null | undefined): Channel | null {
  switch ((preferredContact ?? "").toLowerCase()) {
    case "whatsapp": return "whatsapp";
    case "email": return "email";
    case "phone call": case "sms": case "phone": return "sms";
    default: return null;
  }
}

/**
 * The channel to send on: the client's preference if the org enabled it, else the
 * first enabled channel in fallback order. null = the org has no channel on.
 */
export function resolveChannel(preferredContact: string | null | undefined, avail: ChannelAvailability): Channel | null {
  const pref = preferredChannel(preferredContact);
  if (pref && avail[pref]) return pref;
  return FALLBACK_ORDER.find((c) => avail[c]) ?? null;
}

/** "HH:MM" → minutes since midnight. */
function toMin(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/**
 * Is `nowHHMM` (SAST wall-clock) within the quiet window? Handles overnight
 * ranges like 21:00–07:00. Empty/!null bounds = no quiet hours.
 */
export function withinQuietHours(nowHHMM: string, quietStart: string | null, quietEnd: string | null): boolean {
  if (!quietStart || !quietEnd) return false;
  const n = toMin(nowHHMM), s = toMin(quietStart), e = toMin(quietEnd);
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e; // overnight wrap
}
