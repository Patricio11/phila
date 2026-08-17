import "server-only";
import { LOW_THRESHOLDS, CHANNEL_LABEL, CREDIT_UNIT, type CreditChannel } from "@/lib/payments/packs";

/**
 * Batch 4d/4e - the one low-balance rail for SMS, Email and LivePhila: a bell
 * to every org admin AND an email to the practice, exactly once per crossing
 * (threshold, and zero). Best-effort throughout - a notification hiccup never
 * blocks the send or the session.
 */

/** Pure composer, unit-tested: what the practice reads when a balance dips. */
export function lowCreditEmail(
  channel: CreditChannel,
  after: number,
  kind: "low" | "empty",
  base: string,
): { subject: string; body: string } {
  const label = CHANNEL_LABEL[channel];
  const unit = CREDIT_UNIT[channel];
  if (kind === "empty") {
    return {
      subject: `Out of ${label} ${unit} - top up to stay covered`,
      body: channel === "video"
        ? `Your practice has used all its ${label} ${unit}. Online sessions still run - nothing is ever cut off mid-care - but top up now so the practice stays covered.

Top up: ${base}/hub/billing`
        : `Your practice has used all its ${label} ${unit}. Messages on this channel can't go out until you top up.

Top up: ${base}/hub/billing`,
    };
  }
  return {
    subject: `${label} ${unit} running low - ${after.toLocaleString()} left`,
    body: `Your practice is down to ${after.toLocaleString()} ${label} ${unit}. Top up in Billing so nothing is interrupted.

Top up: ${base}/hub/billing`,
  };
}

async function emailOrgAdmins(orgId: string, subject: string, body: string): Promise<void> {
  const { orgAdminEmailsDb } = await import("@/db/queries/forms");
  const recipients = (await orgAdminEmailsDb(orgId)).slice(0, 10);
  if (recipients.length === 0) return;
  const { sendEmail } = await import("@/lib/messaging/transports");
  const { railEmailHtml } = await import("@/lib/email/templates");
  const html = railEmailHtml({ subject, practiceName: "Phila", body, cta: { label: "Open Billing", url: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/hub/billing` } });
  await Promise.race([
    Promise.allSettled(recipients.map((to) => sendEmail(to, subject, body, "Phila", null, html))),
    new Promise((resolve) => setTimeout(resolve, 6_000)),
  ]);
}

export async function notifyIfLowCredit(orgId: string, channel: CreditChannel, before: number, after: number): Promise<void> {
  try {
    const threshold = LOW_THRESHOLDS[channel];
    const label = CHANNEL_LABEL[channel];
    const unit = CREDIT_UNIT[channel];
    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
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
      const mail = lowCreditEmail(channel, after, "empty", base);
      await emailOrgAdmins(orgId, mail.subject, mail.body);
      return;
    }
    if (before >= threshold && after < threshold) {
      await notifyOrgAdmins(orgId, {
        kind: "credit_low",
        title: `${label} ${unit} running low`,
        body: `${after.toLocaleString()} ${unit} left. Top up in Billing so nothing is interrupted.`,
        href: "/hub/billing",
      });
      const mail = lowCreditEmail(channel, after, "low", base);
      await emailOrgAdmins(orgId, mail.subject, mail.body);
    }
  } catch { /* the balance is the truth; the nudge is best-effort */ }
}
