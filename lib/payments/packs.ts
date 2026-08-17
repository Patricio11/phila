/**
 * Credit packs (Phase 15.1; LivePhila minutes in batch 4d). Prices in ZAR
 * cents. "Credits" are messages for sms/email and MINUTES for video - one
 * ledger, one purchase flow, one low-balance rail for all three.
 */
export type CreditChannel = "sms" | "email" | "video";

export interface CreditPack {
  id: string;
  channel: CreditChannel;
  credits: number;
  priceCents: number;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "sms_500", channel: "sms", credits: 500, priceCents: 25000 },
  { id: "sms_2000", channel: "sms", credits: 2000, priceCents: 90000, popular: true },
  { id: "sms_10000", channel: "sms", credits: 10000, priceCents: 400000 },
  { id: "email_1000", channel: "email", credits: 1000, priceCents: 15000 },
  { id: "email_5000", channel: "email", credits: 5000, priceCents: 60000, popular: true },
  { id: "email_25000", channel: "email", credits: 25000, priceCents: 250000 },
  // LivePhila - secure video minutes. Completed online/hybrid sessions consume
  // their booked length from this balance.
  { id: "video_26500", channel: "video", credits: 26500, priceCents: 95000, popular: true },
];

/** Below this, the hub gets a "top up" nudge. */
export const LOW_CREDIT_THRESHOLD = 25;

/** Per-channel low mark: 25 messages, or ~10% of the LivePhila pack. */
export const LOW_THRESHOLDS: Record<CreditChannel, number> = { sms: 25, email: 25, video: 2650 };

/** The human unit for a channel's credits. */
export const CREDIT_UNIT: Record<CreditChannel, string> = { sms: "credits", email: "credits", video: "minutes" };

export const CHANNEL_LABEL: Record<CreditChannel, string> = { sms: "SMS", email: "Email", video: "LivePhila" };

export function packById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
