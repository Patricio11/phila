# Operator / sub-processor (DPA) register

*The single source of truth is **`lib/compliance/subprocessors.ts`** - typed, rendered
read-only to every org in `/admin/compliance` and printed inside each org's POPIA pack
(`/reports/popia`). Phila maintains it once; every org inherits it. A change is a
one-line code edit + deploy, so the register can never drift from what orgs see.*

Current chain (mirror of the code - see the file for the authoritative wording):

| Provider | Service | Cross-border basis (s72) | Dormant-by-default |
|---|---|---|---|
| Neon | Postgres (all app data at rest) | s72(1)(a) - DPA, GDPR-aligned | No (core) |
| Supabase Storage | Documents/files (private, signed URLs) | s72(1)(a) - DPA | No (core) |
| Resend | Transactional email | s72(1)(a) - DPA; contact details + notice text only | Yes |
| BulkSMS | SMS | - (stays in SA) | Yes |
| Meta (WhatsApp Cloud API) | WhatsApp via the org's own BYO account | s72(1)(b) - data subject's chosen channel + opt-out | Yes |
| AI provider (OpenAI/Anthropic) | AI scribe | s72(1)(b) - org's explicit s72 consent gate + de-identification + ZDR | Yes |
| Paystack | Payments | s72(1)(a) - DPA, PCI-DSS | Yes |
| LiveKit | Video (transient media, never stored) | s72(1)(a) - DPA | Yes |

**Process for adding/changing a provider:** edit `lib/compliance/subprocessors.ts`
(name, service, data categories, region, s72 basis, dormancy) → deploy → the admin
console, every org's view, and every future POPIA pack update together.
