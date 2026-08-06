/**
 * Phase 31.4 - the platform's sub-processor / operator register (POPIA s72).
 * Phila is the operator; each org is the responsible party. Phila maintains this
 * list ONCE; every org inherits it read-only (in the Data & privacy area and
 * inside the downloadable POPIA pack). A change here is a one-line edit + deploy.
 *
 * `crossBorder` states the s72 basis where processing leaves South Africa.
 * Dormant-by-Default integrations only process data once an org switches them on.
 */

export interface SubProcessor {
  name: string;
  service: string;
  dataCategories: string;
  region: string;
  /** POPIA s72 basis where processing crosses the border; null = stays in-region/none. */
  crossBorder: string | null;
  /** Only active once an org/platform admin switches the integration on. */
  dormantByDefault: boolean;
}

export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Neon",
    service: "Postgres database (all application data at rest)",
    dataCategories: "All org + client records (encrypted fields for special categories)",
    region: "EU (dev) → SA region planned before first real client (Phase 19)",
    crossBorder: "s72(1)(a) - processing under a contract upholding POPIA-equivalent protection (Neon DPA, GDPR-aligned)",
    dormantByDefault: false,
  },
  {
    name: "Supabase Storage",
    service: "Document/file storage (private buckets, signed URLs only)",
    dataCategories: "Uploaded documents, org logos, message attachments",
    region: "Configured project region",
    crossBorder: "s72(1)(a) - Supabase DPA, GDPR-aligned safeguards",
    dormantByDefault: false,
  },
  {
    name: "Resend",
    service: "Transactional email",
    dataCategories: "Recipient email addresses + message content (no clinical notes)",
    region: "US/EU",
    crossBorder: "s72(1)(a) - Resend DPA; only contact details + notification text leave SA",
    dormantByDefault: true,
  },
  {
    name: "BulkSMS",
    service: "SMS notifications",
    dataCategories: "Recipient phone numbers + short notification text",
    region: "South Africa",
    crossBorder: null,
    dormantByDefault: true,
  },
  {
    name: "Meta (WhatsApp Cloud API)",
    service: "WhatsApp messages - sent via the ORG's own Meta business account (BYO credentials)",
    dataCategories: "Recipient phone numbers + notification text (no clinical notes)",
    region: "Meta global infrastructure",
    crossBorder: "s72(1)(b) - the data subject's consent to WhatsApp as their chosen contact channel (client-selected preference + opt-out honoured)",
    dormantByDefault: true,
  },
  {
    name: "AI provider (OpenAI or Anthropic - platform-selected)",
    service: "AI scribe drafting",
    dataCategories: "De-identified session text ONLY (names/contacts stripped before any call); zero data retention mode; audio never stored",
    region: "US",
    crossBorder: "s72(1)(b) - the org's explicit AI consent gate (the POPIA s72 acknowledgement in Settings → AI) + de-identification before transfer",
    dormantByDefault: true,
  },
  {
    name: "Paystack",
    service: "Card/EFT payments (platform billing + org BYO gateway)",
    dataCategories: "Payer name, email, amount, payment reference (card data never touches Phila)",
    region: "SA/NG (PCI-DSS)",
    crossBorder: "s72(1)(a) - Paystack DPA; PCI-DSS controls",
    dormantByDefault: true,
  },
  {
    name: "LiveKit (Cloud, when enabled - else self-hosted)",
    service: "Secure video sessions",
    dataCategories: "Ephemeral audio/video streams + display names (never recorded or stored)",
    region: "Nearest edge (Cloud) or Phila-hosted (self-host)",
    crossBorder: "s72(1)(a) - LiveKit DPA; media is transient, no retention",
    dormantByDefault: true,
  },
];
