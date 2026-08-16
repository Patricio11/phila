import type { FormField } from "@/lib/domain/types";

/**
 * Batch 3v - the standard public-booking intake, a PRODUCT default (not mock
 * data): every org's /o/<slug>/book flow collects these fields, because the
 * booking submit depends on their well-known ids (full_name, phone, email,
 * reason, preferred_contact). An org's own intake FORMS drive the /f/<token>
 * road (company intake, waitlist) - this one belongs to booking itself.
 */
export const PUBLIC_INTAKE_TITLE = "A few details before we meet";
export const PUBLIC_INTAKE_INTRO =
  "This helps your counsellor prepare. Only your counsellor sees it, and it's kept confidential under POPIA.";

export const PUBLIC_INTAKE_FIELDS: FormField[] = [
  { id: "full_name", label: "Your full name", type: "text", required: true, sensitive: true, placeholder: "e.g. Lerato Mahlangu" },
  { id: "phone", label: "Mobile number", type: "tel", required: true, sensitive: true, placeholder: "+27 ...", help: "We'll use this to confirm your session." },
  { id: "email", label: "Email (optional)", type: "email", required: false, sensitive: true, placeholder: "you@example.co.za" },
  { id: "reason", label: "What would you like support with?", type: "textarea", required: true, placeholder: "A sentence or two is plenty - only your counsellor will read this.", help: "There's no right answer. Share as much or as little as you like." },
  { id: "preferred_contact", label: "How should we reach you?", type: "radio", required: true, options: ["WhatsApp", "Phone call", "Email"] },
  { id: "first_time", label: "Have you had counselling before?", type: "radio", required: false, options: ["This is my first time", "Yes, before", "I'd rather not say"] },
];
