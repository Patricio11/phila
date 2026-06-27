import type { ConsentPurpose } from "@/lib/domain/enums";

/** The wizard's working state  resumable, persisted to localStorage per org. */
export interface BookingState {
  serviceId: string | null;
  /** null = "any available" counsellor. */
  counsellorId: string | null;
  date: string | null; // YYYY-MM-DD
  slotStart: string | null; // ISO
  /** The counsellor resolved for the chosen slot (matters for "any available"). */
  slotCounsellorId: string | null;
  intake: Record<string, string>;
  consents: Partial<Record<ConsentPurpose, boolean>>;
}

export const EMPTY_BOOKING: BookingState = {
  serviceId: null,
  counsellorId: null,
  date: null,
  slotStart: null,
  slotCounsellorId: null,
  intake: {},
  consents: {},
};
