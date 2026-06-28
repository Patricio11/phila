/**
 * Part-B integration adapters as **typed interfaces** (Closeout §5). Each is a
 * named, typed attach point so Phase 13–17 clip in a real implementation without
 * re-plumbing  the app already depends on the interface, not the vendor.
 *
 * **Dormant-by-Default (Rule #5):** every adapter ships "off"; nothing sends,
 * stores, charges, or calls a model until an admin configures it. The mock impls
 * in `index.ts` are honest about that  they never pretend to deliver.
 */
export type AdapterStatus = "off" | "mock" | "live";

export class AdapterDormantError extends Error {
  constructor(public readonly adapter: string) {
    super(`${adapter} is not configured (dormant)  turn it on in Settings`);
    this.name = "AdapterDormantError";
  }
}

export interface StorageAdapter {
  readonly status: AdapterStatus;
  /** Stage an upload (documents, A4 PDFs); returns a key + a signed URL. */
  put(input: { orgId: string; path: string; contentType: string; bytes?: number }): Promise<{ key: string; url: string }>;
  /** A time-limited URL to read a stored object. */
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
}

export type MessageChannel = "whatsapp" | "sms" | "email";

export interface NotificationsAdapter {
  readonly status: Record<MessageChannel, AdapterStatus>;
  /** Queue a templated message. Honest: `delivered:false` while a channel is dormant. */
  send(input: { channel: MessageChannel; to: string; template: string; data?: Record<string, string> }): Promise<{ queued: boolean; delivered: boolean }>;
}

export interface AiAdapter {
  readonly status: AdapterStatus;
  /** Draft a clinical note from session cues  de-identified, never retaining audio. */
  draftNote(input: { cues: string; deidentify?: boolean }): Promise<{ draft: string; model: string }>;
}

export type PaymentSurface = "platform" | "org_gateway";

export interface PaymentsAdapter {
  readonly status: AdapterStatus;
  /** Charge the platform (subscriptions) or the org's own gateway (client invoices). Idempotent. */
  charge(input: { surface: PaymentSurface; orgId: string; amountCents: number; reference: string; idempotencyKey: string }): Promise<{ id: string; status: "pending" | "succeeded" | "failed" }>;
}

export interface VideoAdapter {
  readonly status: AdapterStatus;
  /** Create an in-region room for an online session. */
  createRoom(input: { appointmentId: string }): Promise<{ url: string; token: string }>;
}

export interface Adapters {
  storage: StorageAdapter;
  notifications: NotificationsAdapter;
  ai: AiAdapter;
  payments: PaymentsAdapter;
  video: VideoAdapter;
}
