import "server-only";
import { now as clockNow } from "@/lib/clock";
import { resolveChannel, withinQuietHours } from "@/lib/messaging/resolve";
import { renderTemplate, withReference, EMAIL_SUBJECTS, type MessageTrigger, type RenderVars } from "@/lib/messaging/templates";
import { appointmentReference } from "@/lib/scheduling/reference";
import { sendWhatsApp, sendWhatsAppTemplate, sendSms, sendEmail, type TransportResult } from "@/lib/messaging/transports";
import { getMessagingSettings, getWhatsappCreds, getWhatsappTemplateName, getWhatsappLastInbound, getTemplateBody, getCreditBalances, isOptedOut, consumeCredit, logMessage } from "@/db/queries/messaging";
import { whatsappWindowOpen, decideWhatsappSend, orderedTemplateParams } from "@/lib/messaging/whatsapp-window";
import { railEmailHtml } from "@/lib/email/templates";
import { withRetry, isTransient } from "@/lib/messaging/retry";
import { readNumberHealth, whatsappSentSince, recordDeadLetter } from "@/db/queries/whatsapp-health";
import { sendsPaused, effectiveLimit } from "@/lib/messaging/whatsapp-health";

/** Base business-initiated WhatsApp sends per org per minute (scaled down by number quality). */
const WA_BASE_PER_MINUTE = 60;

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
  const respectQuiet = trigger === "reminder" || trigger === "no_show" || trigger === "new_message";
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

  // Batch 3l - appointment messages always carry the booking reference. `ref`
  // is the appointment id on those triggers; templates may place {reference}
  // themselves, and withReference() appends it when they don't.
  const refHead = ref.split(":")[0]!; // metering refs may carry a suffix, e.g. "appt_x:email-fallback"
  const reference = refHead.startsWith("appt_") ? appointmentReference(refHead) : undefined;
  const body = withReference(
    renderTemplate(await getTemplateBody(orgId, channel, trigger), { ...vars, reference }),
    reference,
  );

  // WhatsApp is window-aware: inside the client's free 24h window we send a free-form
  // message (free); outside it we can only use a Meta-approved template - and if none is
  // configured we skip honestly rather than have Meta bounce a free-form message.
  let result: TransportResult;
  let attempts = 1;
  let waNote: string | undefined;
  if (channel === "whatsapp") {
    const windowOpen = whatsappWindowOpen(await getWhatsappLastInbound(orgId, to), clockNow());
    const templateName = windowOpen ? null : await getWhatsappTemplateName(orgId, trigger);
    const mode = decideWhatsappSend({ windowOpen, hasTemplate: Boolean(templateName) });
    if (mode === "window_closed") {
      await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "window_closed", detail: "outside 24h window · no approved template configured" });
      return { channel, status: "window_closed" };
    }
    // Phase 34.3 - protect the org's number: paused when Meta restricted it,
    // and throttled by quality (red = a quarter, yellow/flagged = half) + tier.
    // Only business-initiated sends (outside the window) count toward Meta's
    // tier; in-window replies are free and unlimited, so they skip the meter.
    const health = await readNumberHealth(orgId);
    if (sendsPaused(health.status)) {
      await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "paused", detail: `WhatsApp number ${health.status} by Meta - sends paused` });
      return { channel, status: "paused" };
    }
    if (mode === "template") {
      const nowMs = clockNow();
      const perMin = effectiveLimit(health, WA_BASE_PER_MINUTE);
      const lastMinute = await whatsappSentSince(orgId, new Date(new Date(nowMs).getTime() - 60_000));
      const today = health.dailyLimit > 0 ? await whatsappSentSince(orgId, new Date(new Date(nowMs).getTime() - 24 * 60 * 60_000)) : 0;
      if (lastMinute >= perMin || (health.dailyLimit > 0 && today >= health.dailyLimit)) {
        const why = lastMinute >= perMin ? `easing off to protect the number's quality rating (${perMin}/min)` : `Meta's daily limit for this number reached (${health.dailyLimit}/day)`;
        await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: "throttled", detail: why });
        return { channel, status: "throttled" };
      }
    }
    const creds = { phoneNumberId: wa.phoneNumberId, accessTokenEnc: wa.accessTokenEnc };
    // An online session's join link travels with the message (free-form only -
    // an approved template's params are fixed by Meta).
    const waBody = vars.joinLink ? `${body}\n\nJoin online: ${vars.joinLink}` : body;
    if (mode === "free_form") {
      waNote = "in-window (free)";
      ({ result, attempts } = await withRetry(() => sendWhatsApp(creds, to, waBody)));
    } else {
      waNote = "approved template";
      ({ result, attempts } = await withRetry(() => sendWhatsAppTemplate(creds, to, templateName!, "en", orderedTemplateParams(vars))));
    }
  } else if (channel === "sms") {
    ({ result, attempts } = await withRetry(() => sendSms(to, vars.joinLink ? `${body}\nJoin: ${vars.joinLink}` : body)));
  } else {
    // Email goes out branded (HTML shell + plain-text fallback); an online session
    // renders its join link as the button.
    const subject = reference ? `${EMAIL_SUBJECTS[trigger]} · ${reference}` : EMAIL_SUBJECTS[trigger];
    const text = vars.joinLink ? `${body}\n\nJoin your session online:\n${vars.joinLink}` : body;
    const html = railEmailHtml({
      subject,
      practiceName: vars.practiceName ?? "your practice",
      body,
      cta: vars.joinLink ? { label: "Join your session", url: vars.joinLink } : vars.link ? { label: "Open Phila", url: vars.link } : undefined,
    });
    ({ result, attempts } = await withRetry(() => sendEmail(to, subject, text, settings.emailFromName ?? "", settings.emailReplyTo, html)));
  }

  // Phase 34.3 - a send that failed after transient retries is a dead letter:
  // logged honestly, recipient masked, one row per idempotency key.
  if (result.status === "failed" && attempts > 1 && isTransient(result.detail)) {
    await recordDeadLetter(orgId, channel, to, result.detail ?? "transient failure", attempts, `${ref}:${channel}`);
    waNote = `failed after ${attempts} tries - ${result.detail ?? "transient error"}`;
  }

  // Charge a credit only on a real send (never for dormant/failed).
  let cost = 0;
  if (result.status === "sent" && metered) {
    const c = await consumeCredit(orgId, channel, `${ref}:${channel}:${trigger}`, ref);
    cost = c.ok ? 1 : 0;
    if (c.ok) {
      const { notifyIfLowCredit } = await import("@/lib/messaging/low-credit");
      await notifyIfLowCredit(orgId, channel, c.balanceAfter + 1, c.balanceAfter);
    }
  }
  await logMessage({ orgId, channel, to, templateKey: trigger, trigger, status: result.status, detail: result.detail ?? waNote, providerMessageId: result.providerMessageId, costCredits: cost });
  return { channel, status: result.status };
}
