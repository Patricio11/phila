# Phase 14  AI Scribe (POPIA-aware) ✅

*Shipped: 2026-06-30 · Part B · the differentiator  drafts the note AND the funder fields, dormant by default*

> Goal: an AI scribe that turns a counsellor's rough cues into a professional note
> **and** the structured M&E fields in one pass  de-identified, metered, and never
> the author of record.

---

## The model (two gates)
- **Platform (super-admin, `/admin/ai`):** configure **OpenAI and/or Claude** (key
  encrypted at rest, model), and switch **one** on. The active provider powers the
  scribe for every org.
- **Org (hub, Settings → AI assistant):** the **toggle IS the POPIA s.72 cross-border
  consent gate** + a monthly **spend cap**. The scribe stays dormant until *both* the
  platform provider and the org toggle are on.

## What shipped
- **`lib/ai/deidentify.ts`**  strips names + SA ID / phone / email from the cues
  **before any model call**; the model writes about "the client". Unit-tested.
- **`lib/ai/providers.ts`**  one `complete()` across `@anthropic-ai/sdk` + `openai`
  (both asked for a single JSON object) + ZAR-cent cost estimation per model.
- **`lib/ai/scribe.ts`**  `draftNote` (professional, non-diagnostic note +
  `{presentingIssue, risk, outcome, referral}`) and `draftCarePlan` (warm,
  plain-language client summary). Dormant + honest when no provider is active.
- **Wiring**  the session editor's **"AI draft"** turns the note cues into a draft
  (replacing them) + fills the extracted fields; **"Draft with AI"** in the share
  panel writes the client-facing care plan. The counsellor **edits and signs**  the
  AI never signs, sends, or marks a session.
- **Gate + meter + audit**  `generateAiDraft`/`generateCarePlanDraft` check the org
  consent toggle + the monthly cap, record `ai_usage` (tokens + cost), and audit
  every call. An honest "budget used up" block at the cap.
- **Schema**  `ai_providers` (platform), `org_ai_settings` (consent + cap),
  `ai_usage` (ledger). Migrations 0015–0016; org tables RLS'd.

## Honesty + POPIA
- Every draft is labelled **"AI-generated  edit before signing."**
- Only the **signed note + structured fields** persist; **no raw transcript** stored.
- De-identification runs before the cross-border call; production should use a **ZDR**
  (zero-retention) provider endpoint.

## Tests
- 3 de-identify unit tests; 6 integration tests (encrypted-key config, single active
  provider, dormant gate, consent default-off, spend metering, cost). 93
  unit/integration green; tsc + lint + prod build clean.

## Deferred (future)
- **Live-audio STT** (self-hosted Whisper in-region) → cues. The text-cues pipeline
  is the real path today; audio is an additive front-end.

**Done when (met):** with a provider switched on and an org consenting, a counsellor
turns rough cues into a de-identified draft note + funder fields, edits, and signs 
metered, capped, and audited; nothing auto-sent.
