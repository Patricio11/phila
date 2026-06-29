# Phase 12 — Notifications (WhatsApp + Email + SMS) ✅

*Shipped: 2026-06-29 · Part B · honest, metered notifications routed to each client's preferred channel*

> Goal: instant, honest booking/cancel/reschedule/reminder notifications — WhatsApp
> via the org's own number, SMS + email on Phila credits, routed by the client's
> preference, metered + capped, with no fake "sent".

---

## The model
The org enables any of **WhatsApp / SMS / Email**; each message routes by the
client's **preferred contact** among the enabled channels, with a fallback order.
**Opt-out + quiet hours always win** (POPIA). Dormant-by-default — nothing sends
until configured, and a dormant channel reports `dormant`, never a fake "sent".

- **WhatsApp = BYO (Meta Cloud API).** Each org connects its own WhatsApp Business
  number (Phone Number ID / WABA ID / access token / app secret / verify token,
  **encrypted at rest**). Not Phila-metered — the org pays Meta.
- **SMS = Phila bulk (BulkSMS) + credits.** One platform integration; orgs buy
  Phila SMS credits. No per-org SMS account.
- **Email = Phila send + practice identity + credits.** Phila sends from its own
  verified domain with the **practice as display name + Reply-To = the practice**.

## What shipped
- **Schema + credits (12.1):** 7 tables — `org_messaging_settings`,
  `whatsapp_connections` (encrypted), `credit_balances` + `credit_ledger`
  (append-only, idempotency-keyed), `message_log` (honest states),
  `message_templates` (system defaults + org overrides), `message_opt_outs`.
  Seeded (15 system templates, demo settings + 100 SMS/email credits), RLS'd.
- **Settings → Notifications (12.2):** per-channel toggles + quiet hours; the
  WhatsApp **BYO credentials card** (Test/Save/“Help me set up”, copyable webhook
  URL); SMS/Email "Powered by Phila" rows with balances; and a **hub-editable
  template manager** (every channel × trigger, live token preview, reset-to-default).
- **Send pipeline (12.3):** `lib/messaging/deliver.ts` — one chokepoint: resolve
  channel by preference → POPIA gate (opt-out, quiet hours) → meter SMS/email
  credits (charge only on a real send) → transmit → record an honest `message_log`
  state. Pure `resolveChannel`/`withinQuietHours` (unit-tested); real-shaped
  Meta/BulkSMS/Resend transports, dormant until creds exist.
- **Triggers (12.4):** booked / rescheduled / cancelled / no-show wired into the
  real actions; a **reminder sweep** (`/api/cron/reminders`) sends T-24h + T-1h
  exactly once (dedup flags).
- **Platform (12.5):** super-admin **manual credit grant** on the org detail page
  (the bridge until self-serve purchase in **Phase 15.1**); Phila's BulkSMS/Resend
  creds are env-configured.
- **Opt-out + webhooks (12.6):** WhatsApp webhook (verify challenge; inbound STOP →
  opt-out; delivery statuses → message_log) and email (Resend) webhook (delivered/
  failed; bounce/complaint → opt-out). A **Recent activity** view shows every send
  with its honest state.

## Tests
- **Unit:** `resolveChannel` / quiet-hours (7).
- **Integration:** deliver pipeline (4 — preference routing, dormant-no-charge,
  no_credit, opt-out, no_channel) + notify trigger (1, honest message_log).
- **E2E:** the hub edits a WhatsApp template → it persists as an org override.
- 79 unit/integration green; tsc + lint clean. Migrations 0012–0013 on Neon.

## Deferred (by design)
- **Self-serve credit purchase → Phase 15.1** (needs the platform gateway). Manual
  grant covers it until then.
- **Live provider activation:** the transports + webhooks are real but dormant
  until Phila's BulkSMS/Resend creds + each org's Meta number are configured.

**Done when (met):** a real booking/reschedule/cancel/reminder routes to the
client's preferred channel, metered + capped + audited, with honest delivery
states and opt-out/quiet-hours respected.
