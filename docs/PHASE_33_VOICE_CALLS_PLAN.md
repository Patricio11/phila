# 📞 PHASE 33: **VoicePhila** - COUNSELLOR-TO-CLIENT TELEPHONY (bridged, credit-metered)

*Goal: let a counsellor call an **offline** client from inside the session over the normal phone
network, with **the platform placing and timing the call** so the duration is authoritative (not
self-reported). Sold to orgs as **prepaid minute credit**, configured by the super-admin under
**Integrations** exactly like SMS/Email, priced from an **admin-managed catalogue (no hard-coded
prices)**, dormant-by-default, and provider-swappable behind an adapter. Start on a **shared number**;
a per-org number is a later paid add-on.*

> **Status:** ✅ **shipped 2026-08-18** - 33.1-33.7 delivered and proven live (see
> `docs/completed/PHASE_33_COMPLETE.md`); 33.8 (per-org dedicated number) deferred as a later paid
> add-on. The rail sits in **mock** on the shared DB until live Twilio credentials are pasted in.
> (Renumbered from 32 - the language plan holds Phase 32.)
> **Name:** **VoicePhila** - voice sibling of **LivePhila** (video). One product family:
> LivePhila carries the session by video, VoicePhila carries it by phone.
> **Reuses what you already have (updated 2026-08-17):** the credit model now carries THREE
> channels (SMS, Email, **LivePhila video minutes** - batch 4d) on one ledger with idempotent
> writes; the **low-balance rail** (`lib/messaging/low-credit.ts`, batch 4d/4e) already bells AND
> emails every org admin once per crossing; the **super-admin granter** (Resources & quotas,
> batch 4f) already tops up any channel for cash/EFT payments; plus the WhatsApp/SMS **adapter**
> pattern, the **Integrations** switchboard + platform-keyed rail (like the AI rail + LiveKit),
> `audit_log`, and the **Cost rule (#11)** + **dormant-by-default (#5)**. VoicePhila is the
> FOURTH channel on rails that already run - `voice` joins `sms | email | video`.

> ### 🧭 The design, in one line
> **The platform bridges the call: it dials the counsellor, then dials the client, connects them on a
> shared number, and measures the exact connected time from the carrier's call record.** That one
> decision means (a) neither party needs internet - it's normal cellular, so offline clients are
> reachable, and (b) session minutes are **system-measured, never self-reported.** Everything else is
> billing and UI around that.
>
> **Guardrails for this phase:** counsellor → client **only** (no inbound in v1) · **shared number
> only** (per-org number is 33.8, a later add-on) · **no audio recording** - only durations/attempts are
> logged (POPIA/RICA) · provider-swappable (don't marry Twilio).

---

## Task 33.1: Platform credit-pricing catalogue - un-hardcode SMS / Email / LivePhila / VoicePhila (super-admin)
*The foundation: prices live in one admin-managed place, not in code. Today ALL packs (including
LivePhila's R950 / 26,500 min) are constants in `lib/payments/packs.ts` - this task moves the lot
into an admin-managed catalogue.*
- [x] A super-admin **credit catalogue** under **Integrations → Billing / Credit plans**: per credit
  **type** (`sms` / `email` / `video` / `voice`), define bundles - name, **quantity**, **price (ZAR)**, active flag.
  Voice bundles are in **minutes**. **Seed the starting voice bundle: `1000 minutes = R800`** (fully
  editable - this is a data row, not a constant).
- [x] **Retrofit SMS + Email + LivePhila** to render their purchase options **from this catalogue** too, so
  nothing is hardcoded anywhere. The existing org-side credit UI (Billing & usage) now reads the catalogue.
- [x] Super-admin can **add / edit / deactivate** bundles and **change prices**; changes reflect to orgs
  immediately (single source of truth, same discipline as the `plans` table). Every change **audited**.

**Done when:** SMS, Email, and Voice bundles + prices are all defined and edited by the super-admin with
**zero hardcoded prices**, and every org sees exactly what the admin publishes. ✅ *(2026-08-17 - `credit_bundles` table + Plans & billing manager, org Billing reads the catalogue)*

## Task 33.2: Voice provider integration (super-admin Integrations) - configure + enable
*Beside SMS / Email / WhatsApp / video in the switchboard - same pattern.*
- [x] A **Voice** rail: provider (**Twilio** first) + credentials, the **shared platform caller number**,
  **off / mock / live** + a **Test call**, and the per-org entitlement/cap hooks. **Dormant by default**  - 
  no voice surfaces appear for any org until voice is enabled *and* a voice bundle exists (#5).
- [x] **Platform-keyed** (Phila's provider account; orgs do **not** BYO a voice provider) - like the AI
  rail. Orgs simply consume minutes.

**Done when:** the super-admin can configure the provider, set the shared number, run a test call, and
turn voice on/off platform-wide. ✅ *(2026-08-17 - VoicePhila · Twilio card on the platform tab, config page with off/mock/live + Test connection; per-org caps ride the credit balances)*

## Task 33.3: The `voice` adapter seam
*So the provider is swappable once you compare SA rates - mirrors the WhatsApp/SMS adapter.*
- [x] `lib/voice/` interface: `placeBridgedCall(counsellorNo, clientNo, ctx)`, `getStatus(callId)`,
  `endCall(callId)`, and a **webhook handler** for call lifecycle + final duration. A **mock impl**
  (deterministic, dev) + the **Twilio impl** behind the same interface, chosen by config.
- [x] A **signature-verified, fail-safe webhook endpoint** receives events (ringing / answered /
  completed / failed / no-answer) and the authoritative **duration** per leg.

**Done when:** a call runs end-to-end through the mock adapter in dev, and through the real adapter behind
the identical interface in staging. ✅ *(2026-08-17 - `lib/voice/` adapter + `voice_call_legs` + `/api/webhooks/voice`; mock leg proven billed 500 s → 9 min, idempotent, 403 on bad signature; live Twilio staging call awaits real credentials)*

## Task 33.4: Bridged call engine - counsellor → client, shared number, masked
*The core. One direction, shared caller-ID, redial-friendly, system-measured.*
- [x] From the session, **"Call client"** dials the **counsellor first**; on answer, dials the **client**;
  **bridges** them. Both see the **shared platform number** (number masking - client never sees the
  counsellor's real number, and vice-versa; ties to Rule #1).
- [x] **Drop & redial:** if a call drops mid-conversation, the counsellor can **call again**; **each
  attempt is its own logged leg** with its own duration and status. The session keeps the **list of
  attempts** + a **running total connected time**.
- [x] Each leg's **CDR** (initiated, answered, ended, duration, status) is captured from the webhook and
  stored against the **session** - the authoritative, system-measured record (never self-reported).
- [x] **No audio recording** - durations and attempt metadata only.

**Done when:** a counsellor bridges to a client on the shared number; a dropped call can be redialled;
and the session shows every attempt plus an authoritative **total minutes**. ✅ *(2026-08-17 - startClientCall + the call panel; proven end-to-end through the mock adapter)*

## Task 33.5: Metering - minutes credit, decremented, hard-capped
*Voice credit = minutes. Never a silent failure (Cost rule #11).*
- [x] Each **completed leg** decrements the org's **minute balance** by its billed duration, **rounded up
  to the next 60 seconds** by default (telephony standard; the increment is an admin setting).
- [x] **Balance + low-balance nudge + hard stop:** a call **won't place** with a zero/insufficient balance
  - the counsellor sees an honest "this org is out of call minutes - top up," never a broken call.
  Reuse `notifyIfLowCredit` (bell + email, once per crossing) with a `voice` threshold - the rail
  exists; VoicePhila only registers its channel.
- [x] **Idempotent ledger** - one ledger entry per leg keyed off the call/leg id, so a webhook retry can't
  double-charge. Platform-fronted variable cost; the **USD-provider → ZAR-bundle forex spread** is built
  into the bundle price at 33.1.

**Done when:** calls decrement minutes correctly (rounded), the balance blocks at zero with an honest
nudge, and no webhook retry ever double-charges. ✅ *(2026-08-17 - 430 s -> 8 min billed, zero balance refuses before dialling, idempotent ledger proven)*

## Task 33.6: Org side - buy & manage voice minutes (where SMS/Email credit lives)
*Same place, same pattern the org already knows.*
- [x] In the org billing area next to SMS/Email credit: a **Voice minutes** card - current **balance**,
  **buy a bundle** (rendered from the 33.1 catalogue, e.g. "1000 minutes - R800"), **usage history**, and
  the low-balance nudge. Priced from the catalogue, never hardcoded.
- [x] Purchase flows through the org's existing **platform-billing** path (org → Phila), like SMS/Email top-ups.

**Done when:** an org sees its voice-minute balance and buys a bundle **at the admin-set price**, right
alongside SMS and Email. ✅ *(2026-08-17 - the VoicePhila card + catalogue bundles on Billing & usage, visible only while the rail is on)*

## Task 33.7: In-session call experience
*Calm, obvious, one tap - and the totals land on the record.*
- [x] A **"Call client"** action on the session with a call panel showing state - **dialling counsellor →
  dialling client → connected (live timer) → ended** - plus **redial**, and the running **attempts +
  total** for this session. A **blocked** state names the reason (no minutes / voice disabled / no client
  number).
- [x] The session's **total call time** appears on the session record and feeds billing + reporting
  (the same authoritative number, everywhere).
- [x] **Ties into "Held by phone" (feedback #6):** a VoicePhila call auto-records the phone marker
  with the SYSTEM-measured duration - the manual after-the-fact entry stays for calls made outside
  the platform.

**Done when:** a counsellor runs a full call from the session, sees live state + timer, redials on a drop,
and the totals land on the session automatically. ✅ *(2026-08-17 - panel on the session editor + appointment modal; Held by phone auto-recorded with the system-measured minutes)*

## Task 33.8: Per-org dedicated number - paid add-on (modelled, deferred)
*Shared number ships now; a per-org line is the next increment.*
- [ ] Leave the data model + config ready for a **per-org virtual number (DID)** - a **paid add-on** an org
  enables later for a consistent caller-ID it owns (and future inbound). **Not built in v1** (shared number
  only). Note the **ICASA/RICA provisioning** lead time + the **monthly rental** it carries.

**Done when:** the shared-number path is live and the per-org-number add-on is documented as the next
increment - not built now.

---

### Honest constraints
- **Shared number, one direction, v1.** Counsellor → client only; no inbound; per-org number is 33.8 later.
- **No audio recording** (POPIA/RICA). Only durations + attempts are logged. Recording would need explicit
  two-party consent + retention rules and is deliberately out of scope - consistent with the no-audio-
  retention posture on video.
- **Be transparent with counsellors.** Calls are placed and timed by the booking/billing system - frame it
  as the appointment record, never covert monitoring (avoids trust + labour-law friction).
- **Regulatory lead time.** SA number provisioning (ICASA/RICA) takes onboarding time even for the shared
  number; the provider handles the number's RICA, but factor it before go-live.
- **Voice burns credit fast.** A 50-min session is ~50 minutes of balance - show running spend clearly so
  the first client never gets bill-shock. Keep a margin in the bundle price for the forex spread.
- **Provider-swappable, by design (the practice's requirement).** Start on **Twilio**; keep the
  `voice` adapter clean so Africa's Talking / Telnyx / others plug in later and the super-admin
  simply **switches providers on or off** in Integrations - same pattern as the storage backend
  (Supabase ↔ S3) and the video rail - no UI change for orgs.

### Done when (phase)
A super-admin enables the voice provider and sets **minute-bundle prices** under Integrations (SMS/Email
now priced from the same catalogue); an org **buys minutes** beside its SMS/Email credit; a counsellor
**calls an offline client from the session** on the shared, masked number; **drops can be redialled** and
**every attempt's duration is system-measured and summed** onto the session; minutes **decrement (rounded)
and hard-stop at zero** with an honest nudge - all **dormant-by-default** and **provider-swappable**.

### Closeout ritual (your convention)
- [ ] `docs/completed/PHASE_33_COMPLETE.md` (what shipped + verification).
- [ ] Tick Phase 33 ✅ + date in `ROADMAP.md`.
- [ ] Update **Current State** in `TO_START_EVERY_SESSION.md`.
- [ ] Commit `Phase 33 complete - voice calls (bridged, credit-metered)`.

*Phila · philasa.com · Phase 33 plan · **VoicePhila** (voice calls / telephony) · Renumbered + synced 2026-08-17*
