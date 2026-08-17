import "server-only";
import { LOW_THRESHOLDS, CHANNEL_LABEL, CREDIT_UNIT, type CreditChannel } from "@/lib/payments/packs";

/**
 * Batch 4d - the one low-balance rail for SMS, Email and LivePhila. Called
 * after every consumption with the before/after pair; a threshold is
 * announced exactly once (on the crossing), and hitting zero gets its own
 * urgent note. Best-effort - a notification hiccup never blocks the send or
 * the session.
 */
export async function notifyIfLowCredit(orgId: string, channel: CreditChannel, before: number, after: number): Promise<void> {
  try {
    const threshold = LOW_THRESHOLDS[channel];
    const label = CHANNEL_LABEL[channel];
    const unit = CREDIT_UNIT[channel];
    const { notifyOrgAdmins } = await import("@/db/queries/notifications");
    if (before > 0 && after <= 0) {
      await notifyOrgAdmins(orgId, {
        kind: "credit_low",
        title: `Out of ${label} ${unit}`,
        body: channel === "video"
          ? "Online sessions still run - top up so the practice stays covered."
          : `Messages on this channel can't go out until you top up.`,
        href: "/hub/billing",
      });
      return;
    }
    if (before >= threshold && after < threshold) {
      await notifyOrgAdmins(orgId, {
        kind: "credit_low",
        title: `${label} ${unit} running low`,
        body: `${after.toLocaleString()} ${unit} left. Top up in Billing so nothing is interrupted.`,
        href: "/hub/billing",
      });
    }
  } catch { /* the balance is the truth; the nudge is best-effort */ }
}
