/**
 * The catalogue of Phila's OWN platform integrations (system-wide), shown in the
 * super-admin Integrations console. Server-safe data (no icons) so it's importable
 * from both the index page and the per-integration config page. The `key` is the
 * `platform_integrations` row key the encrypted credentials live under.
 */
export type PlatformIntegrationSlug = "paystack" | "livekit" | "storage" | "bulksms" | "resend";

export interface PlatformIntegrationMeta {
  slug: PlatformIntegrationSlug;
  name: string;
  category: string;
  description: string;
  key: string;
}

export const PLATFORM_INTEGRATIONS: PlatformIntegrationMeta[] = [
  { slug: "paystack", name: "Paystack", category: "Payments", description: "Phila's own gateway for credit top-ups + subscription billing.", key: "paystack" },
  { slug: "livekit", name: "Video · LiveKit", category: "Video", description: "In-app online sessions  Phila self-hosted (Docker) or LiveKit Cloud. Same secure token flow either way.", key: "livekit" },
  { slug: "storage", name: "Phila Storage · Supabase", category: "Storage", description: "The platform file store for documents  private bucket, signed URLs only.", key: "phila_storage" },
  { slug: "bulksms", name: "SMS · BulkSMS", category: "Messaging", description: "Phila-provided SMS credits  reminders + notices for clients.", key: "bulksms" },
  { slug: "resend", name: "Email · Resend", category: "Messaging", description: "Phila-provided email  verified domain, practice reply-to.", key: "resend" },
];

export function platformIntegrationBySlug(slug: string): PlatformIntegrationMeta | undefined {
  return PLATFORM_INTEGRATIONS.find((p) => p.slug === slug);
}
