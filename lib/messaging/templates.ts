/**
 * Phase 12  notification message templates. System defaults live here AND are
 * seeded into `message_templates` (orgId null); an org row overrides per channel.
 * WhatsApp/SMS are kept short and POPIA-honest (STOP to opt out); email carries a
 * subject. Variables are `{name}` tokens rendered by renderTemplate().
 */
export type Channel = "whatsapp" | "sms" | "email";
export type MessageTrigger = "booked" | "rescheduled" | "cancelled" | "reminder" | "no_show";

export const CHANNELS: Channel[] = ["whatsapp", "sms", "email"];
export const TRIGGERS: MessageTrigger[] = ["booked", "rescheduled", "cancelled", "reminder", "no_show"];

export interface RenderVars {
  clientName: string;
  practiceName: string;
  serviceName: string;
  counsellorName: string;
  date: string;
  time: string;
}

export const DEFAULT_TEMPLATES: Record<Channel, Record<MessageTrigger, string>> = {
  whatsapp: {
    booked: "Hi {clientName}, your {serviceName} with {counsellorName} at {practiceName} is booked for {date} at {time}. Reply STOP to opt out.",
    rescheduled: "Hi {clientName}, your session at {practiceName} has moved to {date} at {time}. Reply STOP to opt out.",
    cancelled: "Hi {clientName}, your session at {practiceName} on {date} has been cancelled. Reply to rebook.",
    reminder: "Reminder: your {serviceName} at {practiceName} is on {date} at {time}. See you then. Reply STOP to opt out.",
    no_show: "Hi {clientName}, we missed you today at {practiceName}. Reply when you'd like to rebook  we're here.",
  },
  sms: {
    booked: "{practiceName}: your session is booked for {date} at {time}. Reply STOP to opt out.",
    rescheduled: "{practiceName}: your session has moved to {date} at {time}. Reply STOP to opt out.",
    cancelled: "{practiceName}: your session on {date} is cancelled. Call us to rebook.",
    reminder: "{practiceName} reminder: session on {date} at {time}. Reply STOP to opt out.",
    no_show: "{practiceName}: we missed you today. Call us to rebook.",
  },
  email: {
    booked: "Hi {clientName},\n\nYour {serviceName} with {counsellorName} at {practiceName} is confirmed for {date} at {time}.\n\nIf you need to change it, just reply to this email.\n\nWarmly,\n{practiceName}",
    rescheduled: "Hi {clientName},\n\nYour session at {practiceName} has been moved to {date} at {time}.\n\nReply to this email if that doesn't suit.\n\nWarmly,\n{practiceName}",
    cancelled: "Hi {clientName},\n\nYour session at {practiceName} on {date} has been cancelled. Reply to this email whenever you'd like to rebook.\n\nWarmly,\n{practiceName}",
    reminder: "Hi {clientName},\n\nA gentle reminder that your {serviceName} at {practiceName} is on {date} at {time}.\n\nSee you then.\n\nWarmly,\n{practiceName}",
    no_show: "Hi {clientName},\n\nWe missed you at {practiceName} today  no judgement at all. Reply whenever you're ready to rebook.\n\nWarmly,\n{practiceName}",
  },
};

export const EMAIL_SUBJECTS: Record<MessageTrigger, string> = {
  booked: "Your booking is confirmed",
  rescheduled: "Your session has been moved",
  cancelled: "Your session was cancelled",
  reminder: "Session reminder",
  no_show: "We missed you  rebook whenever you're ready",
};

/** Substitute `{token}` placeholders; unknown tokens render empty. */
export function renderTemplate(body: string, vars: Partial<RenderVars>): string {
  return body.replace(/\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "");
}
