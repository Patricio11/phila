import "server-only";
import { now as clockNow } from "@/lib/clock";
import { resolveChannel, withinQuietHours } from "@/lib/messaging/resolve";
import { renderTemplate, EMAIL_SUBJECTS, type MessageTrigger, type RenderVars } from "@/lib/messaging/templates";
import { sendWhatsApp, sendWhatsAppTemplate, sendSms, sendEmail, type TransportResult } from "@/lib/messaging/transports";
import { getMessagingSettings, getWhatsappCreds, getWhatsappTemplateName, getWhatsappLastInbound, getTemplateBody, getCreditBalances, isOptedOut, consumeCredit, logMessage } from "@/db/queries/messaging";
import { whatsappWindowOpen, decideWhatsappSend, orderedTemplateParams } from "@/lib/messaging/whatsapp-window";
import { railEmailHtml } from "@/lib/email/templates";

export interface DeliverInput {
  orgId: string;
  trigger: MessageTrigger;
  ref: string; // e.g. appointmentId  makes metering idempotent
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

  // POPIA  opt-out always wins.
  if (await isOptedOut(orgId, channel, to)) {
    await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "opted_out" });
    return { channel, status: "opted_out" };
  }

  // Quiet hours apply to non-urgent nudges (reminders, follow-ups). Transactional
  // confirmations (booked/rescheduled/cancelled) answer a client action  send anytime.
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

  // WhatsApp is window-aware: inside the client's free 24h window we send a free-form
  // message (free); outside it we can only use a Meta-approved template — and if none is
  // configured we skip honestly rather than have Meta bounce a free-form message.
  let result: TransportResult;
  let waNote: string | undefined;
  if (channel === "whatsapp") {
    const windowOpen = whatsappWindowOpen(await getWhatsappLastInbound(orgId, to), clockNow());
    const templateName = windowOpen ? null : await getWhatsappTemplateName(orgId, trigger);
    const mode = decideWhatsappSend({ windowOpen, hasTemplate: Boolean(templateName) });
    if (mode === "window_closed") {
      await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "window_closed", detail: "outside 24h window · no approved template configured" });
      return { channel, status: "window_closed" };
    }
    const creds = { phoneNumberId: wa.phoneNumberId, accessTokenEnc: wa.accessTokenEnc };
    // An online session's join link travels with the message (free-form only —
    // an approved template's params are fixed by Meta).
    const waBody = vars.joinLink ? `${body}\n\nJoin online: ${vars.joinLink}` : body;
    if (mode === "free_form") {
      waNote = "in-window (free)";
      result = await sendWhatsApp(creds, to, waBody);
    } else {
      waNote = "approved template";
      result = await sendWhatsAppTemplate(creds, to, templateName!, "en", orderedTemplateParams(vars));
    }
  } else if (channel === "sms") {
    result = await sendSms(to, vars.joinLink ? `${body}\nJoin: ${vars.joinLink}` : body);
  } else {
    // Email goes out branded (HTML shell + plain-text fallback); an online session
    // renders its join link as the button.
    const subject = EMAIL_SUBJECTS[trigger];
    const text = vars.joinLink ? `${body}\n\nJoin your session online:\n${vars.joinLink}` : body;
    const html = railEmailHtml({
      subject,
      practiceName: vars.practiceName ?? "your practice",
      body,
      cta: vars.joinLink ? { label: "Join your session", url: vars.joinLink } : undefined,
    });
    result = await sendEmail(to, subject, text, settings.emailFromName ?? "", settings.emailReplyTo, html);
  }

  // Charge a credit only on a real send (never for dormant/failed).
  let cost = 0;
  if (result.status === "sent" && metered) {
    const c = await consumeCredit(orgId, channel, `${ref}:${channel}:${trigger}`, ref);
    cost = c.ok ? 1 : 0;
  }
  await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: result.status, detail: result.detail ?? waNote, providerMessageId: result.providerMessageId, costCredits: cost });
  return { channel, status: result.status };
}
