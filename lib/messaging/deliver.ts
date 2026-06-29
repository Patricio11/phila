import "server-only";
import { now as clockNow } from "@/lib/clock";
import { resolveChannel, withinQuietHours } from "@/lib/messaging/resolve";
import { renderTemplate, EMAIL_SUBJECTS, type MessageTrigger, type RenderVars } from "@/lib/messaging/templates";
import { sendWhatsApp, sendSms, sendEmail } from "@/lib/messaging/transports";
import { getMessagingSettings, getWhatsappCreds, getTemplateBody, getCreditBalances, isOptedOut, consumeCredit, logMessage } from "@/db/queries/messaging";

export interface DeliverInput {
  orgId: string;
  trigger: MessageTrigger;
  ref: string; // e.g. appointmentId — makes metering idempotent
  recipient: { phone?: string | null; email?: string | null; preferredContact?: string | null };
  vars: RenderVars;
}
export interface DeliverOutcome {
  channel: string | null;
  status: string; // no_channel | blocked | opted_out | quiet_hours | no_credit | sent | failed | dormant
}

function sastHHMM(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/**
 * The single send chokepoint (Phase 12.3). Resolve the channel by client
 * preference → POPIA gate (opt-out, quiet hours for non-urgent) → meter SMS/email
 * credits → transmit via the right transport → record an HONEST message_log state.
 * WhatsApp uses the org's number (unmetered by Phila); SMS/Email use Phila credits.
 */
export async function deliver(input: DeliverInput): Promise<DeliverOutcome> {
  const { orgId, trigger, ref, recipient, vars } = input;

  const [settings, wa] = await Promise.all([getMessagingSettings(orgId), getWhatsappCreds(orgId)]);
  const channel = resolveChannel(recipient.preferredContact, {
    whatsapp: settings.whatsappEnabled && wa.live,
    sms: settings.smsEnabled,
    email: settings.emailEnabled,
  });
  if (!channel) return { channel: null, status: "no_channel" };

  const to = channel === "email" ? recipient.email : recipient.phone;
  if (!to) {
    await logMessage({ orgId, channel, to: "unknown", templateKey: trigger, trigger, status: "blocked", detail: "no address for channel" });
    return { channel, status: "blocked" };
  }

  // POPIA — opt-out always wins.
  if (await isOptedOut(orgId, channel, to)) {
    await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "opted_out" });
    return { channel, status: "opted_out" };
  }

  // Quiet hours apply to non-urgent nudges (reminders, follow-ups). Transactional
  // confirmations (booked/rescheduled/cancelled) answer a client action — send anytime.
  const respectQuiet = trigger === "reminder" || trigger === "no_show";
  if (respectQuiet && withinQuietHours(sastHHMM(clockNow()), settings.quietStart, settings.quietEnd)) {
    await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "quiet_hours" });
    return { channel, status: "quiet_hours" };
  }

  const metered = channel === "sms" || channel === "email";
  if (metered) {
    const bal = await getCreditBalances(orgId);
    if (bal[channel] <= 0) {
      await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "no_credit" });
      return { channel, status: "no_credit" };
    }
  }

  const body = renderTemplate(await getTemplateBody(orgId, channel, trigger), vars);
  const result =
    channel === "whatsapp" ? await sendWhatsApp({ phoneNumberId: wa.phoneNumberId, accessTokenEnc: wa.accessTokenEnc }, to, body)
    : channel === "sms" ? await sendSms(to, body)
    : await sendEmail(to, EMAIL_SUBJECTS[trigger], body, settings.emailFromName ?? "", settings.emailReplyTo);

  // Charge a credit only on a real send (never for dormant/failed).
  let cost = 0;
  if (result.status === "sent" && metered) {
    const c = await consumeCredit(orgId, channel, `${ref}:${channel}:${trigger}`, ref);
    cost = c.ok ? 1 : 0;
  }
  await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: result.status, detail: result.detail, providerMessageId: result.providerMessageId, costCredits: cost });
  return { channel, status: result.status };
}
