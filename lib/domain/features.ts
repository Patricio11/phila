import { ORG_FEATURES, type OrgFeature } from "@/lib/domain/enums";
import type { Plan } from "@/lib/domain/types";

/**
 * The feature registry (W3.1) — one place describing every org feature, so the admin
 * console, the entitlement resolver, and Dormant-by-Default all agree. Built on the
 * existing `ORG_FEATURES`; new features register here. `meteredResource` links a
 * feature to a metered pool (credits/quota) for W3.5.
 */
export type FeatureCategory = "clinical" | "communication" | "video" | "payments" | "reporting";
export type MeteredResource = "ai_tokens" | "sms" | "email" | "whatsapp" | "storage";

export interface FeatureMeta {
  key: OrgFeature;
  label: string;
  description: string;
  category: FeatureCategory;
  /** Can the super-admin force this OFF platform-wide (a global kill-switch)? */
  globallyDisableable: boolean;
  /** The metered pool this feature draws on, if any (W3.5). */
  meteredResource?: MeteredResource;
}

export const FEATURE_REGISTRY: Record<OrgFeature, FeatureMeta> = {
  ai: { key: "ai", label: "AI scribe", description: "Draft clinical notes & care plans with AI (POPIA s72 consent-gated).", category: "clinical", globallyDisableable: true, meteredResource: "ai_tokens" },
  video: { key: "video", label: "Video sessions", description: "In-app, in-region LiveKit rooms for online sessions.", category: "video", globallyDisableable: true },
  whatsapp: { key: "whatsapp", label: "WhatsApp", description: "Booking, reminder & follow-up messages over the org's WhatsApp number.", category: "communication", globallyDisableable: true, meteredResource: "whatsapp" },
  sms: { key: "sms", label: "SMS", description: "Phila-provided SMS reminders for clients without WhatsApp.", category: "communication", globallyDisableable: true, meteredResource: "sms" },
  payments: { key: "payments", label: "Payments", description: "The org's own gateway so clients pay them directly for invoices.", category: "payments", globallyDisableable: true },
  funders: { key: "funders", label: "Funders & grants", description: "M&E reporting and funder-portal sharing (k-anonymised).", category: "reporting", globallyDisableable: false },
};

export const FEATURE_LIST: FeatureMeta[] = ORG_FEATURES.map((f) => FEATURE_REGISTRY[f]);

/**
 * Whether an org's **plan** entitles a feature, derived from the existing `Plan`
 * allowances (no duplicate config). Payments (BYO gateway) and funder reporting are
 * available on every plan; the rest gate on the plan's messaging/AI/video allowances.
 */
export function planIncludesFeature(plan: Plan | undefined, feature: OrgFeature): boolean {
  if (!plan) return true; // unknown plan → don't block (fail-open to today's behaviour)
  switch (feature) {
    case "ai": return plan.aiTokens > 0;
    case "video": return plan.videoMinutes > 0;
    case "whatsapp":
    case "sms": return plan.messaging;
    case "payments":
    case "funders": return true;
  }
}
