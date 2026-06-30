/** Notification credit packs (Phase 15.1). Prices in ZAR cents. Shared client+server. */
export interface CreditPack {
  id: string;
  channel: "sms" | "email";
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
];

/** Below this, the hub gets a "top up" nudge. */
export const LOW_CREDIT_THRESHOLD = 25;

export function packById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
