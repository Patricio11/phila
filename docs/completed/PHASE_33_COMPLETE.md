# ✅ Phase 33 complete - VoicePhila (bridged voice calls, credit-metered)

*Closed 2026-08-18. Plan: `docs/PHASE_33_VOICE_CALLS_PLAN.md`. Seven tasks (33.1-33.7), each a
verified green commit; 33.8 (per-org dedicated number) deliberately deferred as a later paid add-on.
Governing principle held throughout: the PLATFORM places and times the call, so minutes are
system-measured, never self-reported; dormant-by-default; provider-swappable; never block care.*

## What shipped

**33.1 · Credit catalogue** (`b4b6daa`) - `credit_bundles` (migration 0077) is the single source of
every purchasable bundle (SMS / Email / LivePhila / VoicePhila): name, quantity, price, active,
popular - edited by the super-admin on Plans & billing (`CreditBundlesManager`), read by org Billing
and by the purchase authority (`startCreditPurchase`). Zero hardcoded prices anywhere; the old
constants are seed-only. VoicePhila starter seeded at 1,000 min = R800.

**33.2 / 33.3 · Admin rail + adapter seam + metered webhook** (`1c33971`) - **VoicePhila · Twilio**
joined the super-admin Phila-platform cards (slug `voice`: Account SID / auth token write-only,
shared caller number, mode Off / Mock / Live, Test connection). `lib/voice/` is the swappable seam
(`VoiceAdapter`: placeBridgedCall / parseWebhook / testConnection; Twilio impl with
X-Twilio-Signature HMAC-SHA1 verified; deterministic mock adapter). `voice_call_legs` (migration
0078) records every leg; `/api/webhooks/voice` bills COMPLETED legs ceil-per-minute exactly once
(ledger key `voice_leg_<id>`), fires the low-credit bell + email, audits as `system:voice`.

**33.4 - 33.7 · Bridged call engine + in-session panel + auto marker + org card** (`ae5c1a6`,
polish `d2d2521`) - "Call client" on the session editor and the appointment modal (every calendar /
dashboard surface, both roles) dials the counsellor first, then bridges the client, both masked by
the shared number; each attempt is its own logged leg with Call again after a drop; the panel shows
live state, the attempts list and the system-measured running total. Honest hard stop BEFORE
dialling (no client number / no counsellor profile number / empty balance - `toE164` normalises SA
numbers, garbage refuses). A completed call **auto-records "Held by phone"** with the carrier-measured
total. Org Billing gained the fourth card (VoicePhila minutes + catalogue bundles), visible only
while the rail is on. Minutes are shown to org admins only; the panel wraps cleanly at 360 px.

## Verification
Every task proven live on the production build with screenshots (mock adapter end to end: leg
placed from the session → webhook completed 430 s → 8 min billed 1000 → 992 → "7m 10s · billed 8
min" + total → header "Held by phone · 8 min" → zero balance disabled the button with the top-up
reason → Billing showed 750 min + the R800 bundle). Unit tests: minute rounding, the Twilio
signature algorithm, `toE164` (292 total at close). ROADMAP + SMOKE_TEST carry every batch.

## Left honestly
- **33.8** per-org dedicated number (DID) - modelled in the plan, not built (paid add-on later).
- Live Twilio credentials + the shared SA number still to be pasted into the admin voice page (the
  rail sits in mock mode on the shared DB); the signature vector gets confirmed against Twilio's
  first real webhook.
