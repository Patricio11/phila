/**
 * The catalogue of Phila's OWN platform integrations (system-wide), shown in the
 * super-admin Integrations console. Server-safe data (no icons) so it's importable
 * from both the index page and the per-integration config page. The `key` is the
 * `platform_integrations` row key the encrypted credentials live under.
 */
export type PlatformIntegrationSlug = "paystack" | "livekit" | "voice" | "storage" | "bulksms" | "resend" | "push";

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
  { slug: "voice", name: "VoicePhila · Twilio", category: "Voice", description: "Bridged counsellor-to-client phone calls on the shared masked number - minutes system-measured, billed per org.", key: "voice" },
  { slug: "storage", name: "Phila Storage", category: "Storage", description: "The platform file store for documents - Supabase or Amazon S3, private bucket, signed URLs only.", key: "phila_storage" },
  { slug: "bulksms", name: "SMS · BulkSMS", category: "Messaging", description: "Phila-provided SMS credits  reminders + notices for clients.", key: "bulksms" },
  { slug: "resend", name: "Email · Resend", category: "Messaging", description: "Phila-provided email  verified domain, practice reply-to.", key: "resend" },
  { slug: "push", name: "Web push", category: "Messaging", description: "Browser / phone notifications for Phila messages - Phila's own VAPID keys, no third party, free. Dormant until switched on.", key: "web_push" },
];

export function platformIntegrationBySlug(slug: string): PlatformIntegrationMeta | undefined {
  return PLATFORM_INTEGRATIONS.find((p) => p.slug === slug);
}
