import type { ConsentPurpose } from "@/lib/domain/enums";

/** The wizard's working state  resumable, persisted to localStorage per org. */
export interface BookingState {
  serviceId: string | null;
  /** How the session is attended; null until chosen (or auto-set when only one). */
  modality: "in_person" | "online" | null;
  /** null = "any available" counsellor. */
  counsellorId: string | null;
  date: string | null; // YYYY-MM-DD
  slotStart: string | null; // ISO
  /** The counsellor resolved for the chosen slot (matters for "any available"). */
  slotCounsellorId: string | null;
  intake: Record<string, string>;
  consents: Partial<Record<ConsentPurpose, boolean>>;
  /** One affirmative acceptance of the Terms & Conditions (which cover the consents). */
  termsAccepted: boolean;
}

export const EMPTY_BOOKING: BookingState = {
  serviceId: null,
  modality: null,
  counsellorId: null,
  date: null,
  slotStart: null,
  slotCounsellorId: null,
  intake: {},
  consents: {},
  termsAccepted: false,
};

/**
 * Accepting the Terms & Conditions grants the everyday consents the booking needs
 * (booking + confidential notes are required; reminders, demographics and funder
 * reporting are described in the terms). Cross-border AI processing is never
 * bundled here  it stays a separate, explicit consent gated by the org's AI feature.
 */
export const TERMS_CONSENTS: Partial<Record<ConsentPurpose, boolean>> = {
  booking: true,
  notes: true,
  comms: true,
  demographics: true,
  funder_reporting: true,
};
