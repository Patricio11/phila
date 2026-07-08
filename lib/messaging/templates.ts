/**
 * Phase 12  notification message templates. System defaults live here AND are
 * seeded into `message_templates` (orgId null); an org row overrides per channel.
 * WhatsApp/SMS are kept short and POPIA-honest (STOP to opt out); email carries a
 * subject. Variables are `{name}` tokens rendered by renderTemplate().
 */
export type Channel = "whatsapp" | "sms" | "email";
export type MessageTrigger =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "reminder"
  | "no_show"
  | "document_shared"
  | "client_uploaded_document"
  | "form_sent"
  | "waitlist_slot";

export const CHANNELS: Channel[] = ["whatsapp", "sms", "email"];
export const TRIGGERS: MessageTrigger[] = ["booked", "rescheduled", "cancelled", "reminder", "no_show", "document_shared", "client_uploaded_document", "form_sent", "waitlist_slot"];

export interface RenderVars {
  clientName: string;
  practiceName: string;
  serviceName: string;
  counsellorName: string;
  date: string;
  time: string;
  documentName?: string;
  formName?: string;
  formLink?: string;
}

export const DEFAULT_TEMPLATES: Record<Channel, Record<MessageTrigger, string>> = {
  whatsapp: {
    booked: "Hi {clientName}, your {serviceName} with {counsellorName} at {practiceName} is booked for {date} at {time}. Reply STOP to opt out.",
    rescheduled: "Hi {clientName}, your session at {practiceName} has moved to {date} at {time}. Reply STOP to opt out.",
    cancelled: "Hi {clientName}, your session at {practiceName} on {date} has been cancelled. Reply to rebook.",
    reminder: "Reminder: your {serviceName} at {practiceName} is on {date} at {time}. See you then. Reply STOP to opt out.",
    no_show: "Hi {clientName}, we missed you today at {practiceName}. Reply when you'd like to rebook  we're here.",
    document_shared: "Hi {clientName}, {practiceName} shared a document with you: {documentName}. Open it in your private portal. Reply STOP to opt out.",
    client_uploaded_document: "{clientName} uploaded a document ({documentName}) at {practiceName}.",
    form_sent: "Hi {clientName}, {practiceName} would like you to fill in a quick form: {formName}. Open it here: {formLink}  it only takes a few minutes. Reply STOP to opt out.",
    waitlist_slot: "Hi {clientName}, good news  a slot has opened with {counsellorName} at {practiceName} on {date} at {time}. Reply YES to take it and we'll confirm. Reply STOP to opt out.",
  },
  sms: {
    booked: "{practiceName}: your session is booked for {date} at {time}. Reply STOP to opt out.",
    rescheduled: "{practiceName}: your session has moved to {date} at {time}. Reply STOP to opt out.",
    cancelled: "{practiceName}: your session on {date} is cancelled. Call us to rebook.",
    reminder: "{practiceName} reminder: session on {date} at {time}. Reply STOP to opt out.",
    no_show: "{practiceName}: we missed you today. Call us to rebook.",
    document_shared: "{practiceName}: a new document ({documentName}) is in your portal.",
    client_uploaded_document: "{practiceName}: {clientName} uploaded {documentName}.",
    form_sent: "{practiceName}: please fill in this form ({formName}): {formLink}",
    waitlist_slot: "{practiceName}: a slot opened with {counsellorName} on {date} at {time}. Reply YES to take it. STOP to opt out.",
  },
  email: {
    booked: "Hi {clientName},\n\nYour {serviceName} with {counsellorName} at {practiceName} is confirmed for {date} at {time}.\n\nIf you need to change it, just reply to this email.\n\nWarmly,\n{practiceName}",
    rescheduled: "Hi {clientName},\n\nYour session at {practiceName} has been moved to {date} at {time}.\n\nReply to this email if that doesn't suit.\n\nWarmly,\n{practiceName}",
    cancelled: "Hi {clientName},\n\nYour session at {practiceName} on {date} has been cancelled. Reply to this email whenever you'd like to rebook.\n\nWarmly,\n{practiceName}",
    reminder: "Hi {clientName},\n\nA gentle reminder that your {serviceName} at {practiceName} is on {date} at {time}.\n\nSee you then.\n\nWarmly,\n{practiceName}",
    no_show: "Hi {clientName},\n\nWe missed you at {practiceName} today  no judgement at all. Reply whenever you're ready to rebook.\n\nWarmly,\n{practiceName}",
    document_shared: "Hi {clientName},\n\n{practiceName} has shared a document with you: {documentName}. You can view it anytime in your private portal.\n\nWarmly,\n{practiceName}",
    client_uploaded_document: "{clientName} has uploaded a document ({documentName}). You can review it in the practice console.\n\n{practiceName}",
    form_sent: "Hi {clientName},\n\n{practiceName} would like you to complete a short form: {formName}.\n\nYou can fill it in whenever suits you:\n{formLink}\n\nIt only takes a few minutes, and your answers are kept confidential.\n\nWarmly,\n{practiceName}",
    waitlist_slot: "Hi {clientName},\n\nGood news  a slot has opened with {counsellorName} at {practiceName} on {date} at {time}. You're on our waitlist, so we wanted to offer it to you first.\n\nReply to this email to take it and we'll confirm the booking.\n\nWarmly,\n{practiceName}",
  },
};

export const EMAIL_SUBJECTS: Record<MessageTrigger, string> = {
  booked: "Your booking is confirmed",
  rescheduled: "Your session has been moved",
  cancelled: "Your session was cancelled",
  reminder: "Session reminder",
  no_show: "We missed you  rebook whenever you're ready",
  document_shared: "A document was shared with you",
  client_uploaded_document: "A client uploaded a document",
  form_sent: "A form to fill in",
  waitlist_slot: "A slot has opened — it's yours if you'd like it",
};

/** Substitute `{token}` placeholders; unknown tokens render empty. */
export function renderTemplate(body: string, vars: Partial<RenderVars>): string {
  return body.replace(/\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "");
}
