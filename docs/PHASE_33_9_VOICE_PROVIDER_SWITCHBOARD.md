# 📞 PHASE 33 — Task 33.9: Voice provider switchboard + Africa's Talking adapter

*Addendum to `PHASE_33_VOICE_CALLS_PLAN.md`. Generalises the Twilio-only rail (33.2) into a proper
**multi-provider switchboard** — many voice providers configurable under super-admin Integrations, but
**exactly one active at a time** — and adds **Africa's Talking** as the second provider behind the existing
`voice` adapter (33.3). Same pattern as your storage switch (S3 ↔ MinIO) and the video rail. No change for
counsellors or orgs.*

> **Status:** ⏳ not started. Depends on 33.2–33.5 (shipped). AT adapter should follow the SA validation
> checklist (33.9c) **before** it's written — don't build until the SA rate + number are confirmed.

---

## 33.9a — The switchboard (many configured, one active)
*Voice providers behave exactly like your storage backends: configure any, enable one.*
- [ ] Under **super-admin → Integrations → VoicePhila**, list the available providers (**Twilio**,
  **Africa's Talking**, later Telnyx/others). Each is a **config card**: credentials, the shared SA
  caller number/ID, **off / mock / live**, and a **Test connection / Test call**.
- [ ] **Exactly ONE provider is `active` at a time.** A provider **cannot be enabled until its Test
  passes**. Enabling a provider **auto-disables** the current one (config → test → enable). Every switch
  is **audited** (who, when, from→to).
- [ ] The **active** provider is what **every counsellor→client call, in every org, routes through** —
  the `voice` adapter (33.3) selects the impl from the active config. **Orgs never see or pick a
  provider**; counsellors just tap "Call client" (Rule: no org-facing change).
- [ ] **Global, not per-org** (deliberate): one active provider platform-wide keeps routing, billing, and
  the shared number simple. Per-org provider choice is explicitly out of scope.
- [ ] **Switch applies to NEW calls only** — flipping the provider must not drop calls already in progress.

**Done when:** a super-admin can configure ≥2 providers, test each, and enable exactly one; the active one
carries all counsellor→client calls; switching is one guarded, audited action with zero counsellor/org impact.

## 33.9b — The Africa's Talking adapter (second `voice` impl)
*AT's model = Twilio's model (POST to init → callback returns XML → final webhook with duration+cost), so
this is one more adapter behind the seam you already built.*

- [ ] **Initiate** (`placeBridgedCall`): POST to AT's voice `/call` with `username` + `apiKey`, `from` =
  your **AT SA number**, `to` = the **counsellor**. (Auth is username/apiKey, not Twilio SID/token.)
- [ ] **Bridge callback** — on answer, AT hits your callback URL; return AT's Dial action instead of TwiML:
  ```xml
  <?xml version="1.0"?>
  <Response>
    <Dial phoneNumbers="+27CLIENT" callerId="+27YOUR_AT_NUMBER" maxDuration="3600"/>
  </Response>
  ```
  (`maxDuration` doubles as a runaway-call safety cap.)
- [ ] **Webhook / final notification mapping** → your existing internal CDR shape:
  | AT field | → internal |
  |---|---|
  | `durationInSeconds` | leg duration (→ round up 60s, meter as 33.5) |
  | `callSessionState` / `isActive` | leg status (ringing/answered/completed/failed) |
  | `amount` + `currencyCode` | provider cost (platform cost tracking only) |
  | `direction`, `callerNumber`, `destinationNumber` | leg metadata |
- [ ] **Callback verification is different from Twilio** — AT doesn't sign requests. Verify authenticity via
  **IP allowlist** (AT's published ranges) and/or a **secret token in the callback URL path**, not signature
  validation. Wire this into the fail-safe webhook (33.3).
- [ ] **Outbound-only stays enforced** — the AT SA number exists for caller-ID; set its **inbound handler to
  `<Reject/>`** (or leave unconfigured) so it can never receive a call. (Simpler than Twilio: no inbound wiring.)
- [ ] Org billing is unchanged: it still meters the **system-measured** duration (33.5), independent of the
  provider's own `amount`.

**Done when:** with Africa's Talking set active, a counsellor bridges to a client on the AT SA number, the
call is measured + metered identically to Twilio, and the callback is verified — all behind the same `voice`
adapter, no UI change.

## 33.9c — SA validation checklist (do this in AT's sandbox BEFORE writing 33.9b)
*The only real unknowns — AT's home turf is East/West Africa, so confirm SA specifically.*
- [ ] **SA mobile outbound rate** — is it actually below Twilio's? (the whole reason to add it)
- [ ] **SA virtual-number availability** + ICASA/RICA provisioning lead time.
- [ ] **SA voice quality / coverage / reliability** on a real test call (mobile networks).
- [ ] **Billing currency** — can you be billed in **ZAR** (kills the USD forex spread that eats voice margin)?
- [ ] **End-to-end sandbox call** (init → Dial bridge → final webhook with duration) proven before committing.

**Done when:** AT's real SA rate, number, and quality are confirmed and the cost win over Twilio is *proven*,
not assumed — then 33.9b is worth building.

---

### Honest constraints
- **One active provider, platform-wide.** Not per-org — keeps the shared number, routing, and billing sane.
- **Don't assume AT is cheaper for SA** until 33.9c confirms it; AT's strength is Kenya/Nigeria/East Africa,
  not SA. The adapter is easy; the cost case needs proof.
- **The switch is config-plumbing, not a feature to flip casually** — in practice you'll pick one provider
  and stay; the value is a clean, no-code migration path + fallback (same philosophy as the storage switch).
- **Provider-agnostic billing:** org minutes are always the system-measured duration, whichever provider is
  active — so a provider switch never changes what an org is charged.

### Closeout ritual
- [ ] `docs/completed/PHASE_33_9_COMPLETE.md`; tick 33.9 in the voice plan + `ROADMAP.md`.
- [ ] Update `INFRA.md` sub-processor register if the active provider changes (Twilio → Africa's Talking).
- [ ] Commit `Phase 33.9 — voice provider switchboard + Africa's Talking adapter`.

*Companion to `PHASE_33_VOICE_CALLS_PLAN.md` · VoicePhila · Phila · philasa.com · 2026-08-20*
