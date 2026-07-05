# Phila — Production Readiness Plan

> **Purpose.** Single tracking document for taking Phila from "demo-complete, mock-behind-the-seam"
> to "production-safe, fully DB-backed, admin-governable, and market-ready." Born out of the
> 2026-07-05 full-system audit (security, mock-data, seed, UX, docs) + market research.
>
> **How to use.** Each item is a checkbox. Tick it in the **same commit** that lands it (repo
> convention, see `TO_START_EVERY_SESSION.md`). Keep the workstream status lines at the top of each
> section current. When a whole workstream closes, note the date. Every commit stays green:
> `npx tsc --noEmit` · `npx eslint` · `npm test` · `npm run build`.
>
> **Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · 🔴 P0 (ship-blocker) ·
> 🟠 P1 (before real orgs) · 🟡 P2 (quality/scale) · 🟢 P3 (moat / growth).
>
> **Last updated:** 2026-07-05 (created).

---

## 0. Orientation — what's actually true today

- **Provider seam.** `lib/data-provider.ts` defines `DataProvider` (84 methods). In `db` mode,
  `lib/db-provider.ts` spreads `mockProvider` and overrides ~59; **25 still return mock fixtures.**
  No UI reads fixtures directly — every mock surface leaks through an un-overridden provider method,
  so each gap is a contained "swap the method + wire the action" job, not a rewrite.
- **Feature flags** are **org-controlled only**: `ORG_FEATURES = ["ai","video","whatsapp","sms","payments","funders"]`
  (`lib/domain/enums.ts`), stored in `orgs.features` JSONB, toggled by org admins via
  `saveOrgFeature` (`app/hub/settings/actions.ts`), gated by `requireOrgFeature()` (`lib/auth/guard.ts`).
  **The super-admin cannot currently override features globally or per-org** → Workstream 3.
- **Security model** is documented as 3 layers (route guard = UX, DAL = real gate, RLS = isolation),
  but **RLS is inert at runtime** (owner connection, no org GUC, HTTP driver) and **two action modules
  have no guard at all** → Workstream 0.
- **Dormant-by-Default** is honoured well: SMS/WhatsApp/email/payments/AI/video do a real send when
  configured and an honest no-op otherwise — never a fake success. Keep this invariant.

---

## Workstream 0 — 🔴 CRITICAL SECURITY (ship-blockers)

**Status:** not started. *Nothing goes near real client data until this closes.*

### 0.1 Guard + org-scope the unauthenticated action modules
`app/app/appointments/actions.ts` and `app/app/sessions/[id]/actions.ts` are `"use server"` endpoints
with **no `require*` guard** — any caller can mutate any org's appointments and burn its AI budget.

- [ ] Add `const { principal, membership } = await requireOrg([...])` (or a new `requireCounsellor`) to
      the top of **every** exported action in both files.
- [ ] `rescheduleAppointment` / `cancelAppointment` / `markProgress` → pass `membership.orgId` into the query.
- [ ] `db/queries/appointments.ts`: add `and(eq(appointments.orgId, orgId))` to `rescheduleAppointment`,
      `cancelAppointment`, `setAppointmentState` (currently filter by `id` only).
- [ ] `generateAiDraft` / `generateCarePlanDraft`: verify the appointment belongs to the caller's org
      **before** reading the client name or calling the AI / `recordAiUsage`.
- [ ] Derive the audit `teamRole` from the resolved membership — stop hard-coding `"counsellor"`.
- [ ] Regression test: a counsellor in org B gets 403/404 on an org-A appointment id.

### 0.2 Make RLS actually enforce at runtime (Phase 19 "runtime cutover")
`db/rls.sql` is correct but bypassed: `db/client.ts` connects as `neondb_owner` (`BYPASSRLS`), the org
GUC is never set, and `neon-http` is stateless so transaction-local GUCs can't survive.

- [ ] Switch the request-path connection to the non-owner `phila_app` role (`DATABASE_URL_APP`).
- [ ] Move to a session-capable driver (neon serverless WebSocket pool or `postgres`/`pg`).
- [ ] Wrap each request's queries in a transaction that runs
      `set_config('app.org_id', <caller org>, true)` and `app.is_super` where relevant, **before** any query.
- [ ] Keep the owner connection for migrations/seed/webhooks that legitimately cross orgs.
- [ ] CI test: run as `phila_app`, assert cross-org reads return **0 rows** for every tenant table.
- [ ] Add RLS to the 3 uncovered tables (`platform_integrations`, `ai_providers`, `user_presence`) —
      lock the first two to super-admin/owner, isolate `user_presence` by org.

### 0.3 Fix the fail-open cron
- [ ] `app/api/cron/reminders/route.ts`: fail **closed** in production when `CRON_SECRET` is unset
      (currently `if (secret && …)` → public reminder fan-out). Only allow the open branch when
      `NODE_ENV !== "production"`.

---

## Workstream 1 — 🟠 KILL THE MOCK (real data everywhere, no fake saves)

**Status:** not started. *These "look real, silently discard data" — the most dangerous class.*

### 1.1 Clinical (highest user impact)
- [ ] `getSession` → DB read of the real session + note (`db-provider.ts` override + `db/queries`).
- [ ] `signNote` (`app/app/sessions/[id]/actions.ts`) → **persist** the note body + signature; today audit-only.
- [ ] `shareCarePlan` → persist the share.
- [ ] `addCarePlanStep` (`app/app/clients/actions.ts`) → persist the step (stop returning a fake id).
- [ ] Supervision: `getSupervisionQueue` / `getSupervisionOverview` → DB; `signOffNote` → persist decision + comment.

### 1.2 Outcomes (small, high value — makes the dashboard real)
- [ ] `components/outcomes/outcome-capture.tsx` `save()` → write `outcome_measures` (table + sparkline
      already exist; only the server action is missing). Unlocks the counsellor trend chart.

### 1.3 Client portal
- [ ] `getClientProfile` + `listAppointmentsForClient` → DB.
- [ ] `saveClientProfile` / `changeClientPassword` / `setClientTwoFactor` (`app/me/profile/actions.ts`) → persist.
- [ ] Wire portal **Pay** button (`components/client/invoice-list.tsx`) → mint a `/pay/[token]` and open it
      (the whole pay-link + Paystack webhook machinery already works).
- [ ] Client↔counsellor messaging channel (distinct from staff `message_threads`) — `listConversations` is mock.

### 1.4 Hub team management
- [ ] `listTeam` / `getTeamMemberDetail` → DB.
- [ ] `saveTeamMember` / `inviteMember` / `sendSetupLink` (`app/hub/team/actions.ts`) → persist membership + role.

### 1.5 Org / platform settings (stop discarding saves)
- [ ] `saveOrgProfile` (`app/hub/settings/actions.ts`) → persist to the org row; **remove the hardcoded fake
      registration/practice numbers** in `app/hub/settings/page.tsx` (credibility + POPIA risk).
- [ ] `saveInvoiceSettings` → persist VAT/banking/invoice-prefix; `getInvoiceSettings` → DB.
- [ ] Public booking policy: `getBookingSettings` → DB + booking-settings save persists (pairs with §6 IA).
- [ ] `getOrgSettings` (payment-connection status), `getPlatformSettings` (VAT) → DB.

### 1.6 Client merge
- [ ] `mergeClients` (`app/hub/clients/actions.ts`) → actually re-point sessions/notes/invoices/consents to
      the kept id and soft-delete the losers (detection via `findDuplicateClients` is already real).

### 1.7 Super-admin console (lower user-visibility; overlaps Workstream 3)
- [ ] `getPlatformOverview`, `listPlatformOrgs`, `getPlatformOrgDetail` → DB.
- [ ] `getAiRail`, `listIntegrations`, `listPlatformAudit` → DB.
- [ ] `listOnboardingRequirements` / `getOrgOnboardingReview` → DB; `saveOnboardingRequirements` /
      `reviewOnboardingDoc` → persist.
- [ ] `listOrgSlugs` → DB (public micro-site static params).

> **Definition of done for W1:** grep for `"(mock)"` / `"Phase .. persists"` in `app/**/actions.ts`
> returns nothing that runs under `isDb()`, and every `DataProvider` method used by a shipped page is
> a DB override.

---

## Workstream 2 — 🟠 SECURITY HARDENING (Phase 19)

**Status:** not started.

- [ ] **Security headers / middleware.** Add a `headers()` block (or `middleware.ts`): HSTS, CSP
      (incl. `frame-ancestors 'none'` except the room page), `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy`. Currently `next.config.ts` sets none and there is no middleware.
- [ ] **Prompt (don't enforce) 2FA.** After sign-in, if a privileged user (super-admin / org-admin /
      supervisor) hasn't enabled 2FA, show a **skippable** prompt encouraging setup — never block access.
      Skipping proceeds straight to the dashboard; "remind me later" is fine. The user can enable/disable
      2FA any time from **Settings → Security** (already exists). Do **not** wire `requiresTwoFactor()` into
      the guards as a hard gate. (Optional: let the super-admin set a soft org-policy "recommend 2FA" that
      only changes prompt copy, still skippable.)
- [ ] **Email verification.** Reconsider `requireEmailVerification:false` for org-admin self-registration.
- [ ] **WhatsApp webhook signature.** Verify `X-Hub-Signature-256` HMAC before processing
      (`app/api/webhooks/whatsapp/route.ts`) — currently unauthenticated (Paystack webhook is the model).
- [ ] **Video join links.** Add expiry + nonce to `signJoin` (`lib/video/livekit.ts`); invalidate on
      cancel/reschedule; scope host to assigned counsellor / supervisor / org_admin, not any org member.
- [ ] **Rate limiting.** Add IP/token throttling (Upstash/Vercel KV or Better Auth `rateLimit`) on login,
      booking (`app/o/[slug]/book`), form submit (`app/f/[token]`), pay, `public-events`, and AI actions.
- [ ] **Timing-safe comparisons.** Use `timingSafeEqual` in `paystackSignatureValid` and `verifyJoin`
      (mirror `invoice-link.ts`).
- [ ] **Audit integrity.** `signNote` / `markProgress` write real `orgId` + actor; make clinical-access
      audit **fail-strict** (`lib/audit/index.ts` currently swallows write failures).
- [ ] **Password reset / activation.** Wire the no-op stubs (`app/(auth)/actions.ts`) to Better Auth with
      single-use expiring tokens.
- [ ] **Uploads.** Server-side content-type sniff / pin the signed content-type (`lib/documents/quota.ts`
      trusts the client); confirm `scanObject` is a real AV hook before launch.
- [ ] **Secrets.** Rotate `BETTER_AUTH_SECRET`, `PHILA_FIELD_KEY`, DB passwords before go-live; keep prod
      secrets out of the OneDrive-synced tree.
- [ ] **`exportGrantReport`** — verify grant→org ownership before it logs a `pii.export`.
- [ ] **Retention clocks (POPIA × HPCSA).** Soft-delete must honour HPCSA Booklet 9 retention (≥6y dormant,
      minors→21, incapacity→lifetime) and reconcile with POPIA deletion requests — per-record-type clock,
      not hard delete. Feeds the data-subject export/erasure tooling.
- [ ] **AI cross-border (POPIA s72).** Confirm the LLM processor contract is zero-retention + POPIA-adequate,
      or rely on explicit consent (the AI toggle already is the s72 consent gate); prefer SA/EU hosting +
      de-identify-before-call (already implemented). Document this in `SECURITY.md`.

---

## Workstream 3 — 🟠 PLATFORM FEATURE GOVERNANCE & ADMIN CONTROL *(explicit ask)*

**Status:** not started. *Give the super-admin full, real control to enable/disable functionality
globally or per-org, and to manage subscriptions/quotas (storage, SMS, AI, etc.).*

### 3.1 The entitlement model (design first)
Introduce a clear precedence chain so every feature resolves the same way:

```
effective(feature, org) =
     platform_kill_switch(feature)            // super-admin can force-OFF globally (e.g. disable AI everywhere)
  ?  plan_entitlement(org.plan, feature)      // does the org's subscription plan include it?
  ?  org_override(org, feature)               // super-admin per-org grant/deny (beta access, or suspend)
  ?  org_self_toggle(org.features, feature)   // org admin's own on/off (today's behaviour)
```

- [ ] Extend `ORG_FEATURES` into a **feature registry** (`lib/domain/features.ts`): each feature has
      `key`, `label`, `description`, `category`, `defaultPlanTiers`, `globallyDisableable`, `dependsOn`,
      `meteredResource?` (e.g. `sms`, `storage`, `ai_tokens`). New features (Workstream 7) register here.
- [ ] New tables (migration + RLS): `platform_feature_flags` (global kill-switch + default state per feature),
      `org_feature_overrides` (`orgId`, `feature`, `state: force_on|force_off|inherit`, `reason`, `setBy`, `setAt`),
      `plans` entitlements (`plan → features[] + quotas`), and per-org `entitlements`/quota rows.
- [ ] Central resolver `resolveFeature(orgId, feature)` used by `requireOrgFeature()` and by hub UI so the
      org's own toggle is disabled/greyed with a reason when the platform or plan overrides it.
- [ ] Audit every platform/override change (`platform.feature.toggle`, `org.override.set`).

### 3.2 Admin: global feature control
- [ ] `app/admin/features/page.tsx` (new nav item) — matrix of all features with a **global** on/off/kill
      switch and default-state control; e.g. disable **AI-scribe** platform-wide instantly.
- [ ] Actions `setPlatformFeature(feature, state)` — guarded by `requireSuperAdmin`, persisted, audited.

### 3.3 Admin: per-org feature control
- [ ] On `app/admin/orgs/[id]/page.tsx` — a feature panel showing each feature's **effective** state and
      the resolution reason, with per-org **force-on / force-off / inherit** controls (`setOrgFeatureOverride`).
      Use cases: grant a beta feature to one org; suspend `payments`/`ai` for an org in breach.
- [ ] Show which plan the org is on and what that plan entitles.

### 3.4 Admin: subscription & plan management (make it real)
- [ ] Migrate `listPlans` writes + `getPlatformOrgDetail` to DB (overlaps W1.7).
- [ ] `app/admin/plans` — CRUD plans: price, included features, and **quotas** (storage GB, SMS/mo,
      WhatsApp/mo, AI tokens/mo, seats). Persisted + audited.
- [ ] Assign/upgrade/downgrade an org's plan from `app/admin/orgs/[id]` (`setOrgPlan`), with effect on
      entitlements + quotas immediately reflected by the resolver.

### 3.5 Admin: metered resources & credits (storage / SMS / email / AI)
- [ ] Unify the existing `credit_balances` / `credit_ledger` (SMS/email) with **storage** and **AI-token**
      meters under one `org_resource_meters` view.
- [ ] Extend `grantMessagingCredits` (already real) into `adjustOrgResource(orgId, resource, delta, reason)`
      covering sms, email, whatsapp, **storage**, ai_tokens — guarded + audited.
- [ ] `app/admin/orgs/[id]` panel: current usage vs quota per resource, with top-up / set-limit controls;
      surface `org_storage_usage` (already seeded) here.
- [ ] Enforcement: when a metered resource is exhausted, the feature no-ops honestly (Dormant-by-Default),
      and the hub shows an "add credits / upgrade plan" state — never a silent failure or fake success.

### 3.6 Admin: enabling the new (Workstream 7) features
- [ ] Every new feature ships **registered in the feature registry (3.1)** and **defaulted OFF**, so the
      super-admin can roll it out globally, per-plan, or per-org from day one (beta cohort → GA).

> **Definition of done for W3:** from `/admin`, a super-admin can (a) kill AI-scribe platform-wide,
> (b) force-enable a beta feature for exactly one org, (c) move an org between plans and see its features
> + quotas change, (d) top up or cap an org's storage/SMS/AI, and (e) roll out a brand-new feature to a
> chosen cohort — all persisted, audited, and reflected instantly by `requireOrgFeature`.

---

## Workstream 4 — 🟡 SEED & DEMO REALNESS

**Status:** not started. *So every page has meaningful data and every role has a login.* (`db/seed-all.ts`)

- [ ] Seed appointments for **all four** counsellors (only Nomsa has any → 3 empty dashboards).
- [ ] Give the 30-client M&E cohort time-anchored appointments (grant "sessions delivered" reads ~0 today).
- [ ] Seed `session_notes` from the existing `supervisionTemplates` fixture (never imported) so supervision +
      note history are real.
- [ ] Add logins (`user` + `account` + `org_members`) for the missing roles: **front_desk** (Lindiwe),
      **finance** (Riaan), **programme_manager** (Bongani) — also fixes a broken team-thread participant.
- [ ] Seed a **second org** (admin + a few clients/appointments) so tenant-isolation / RLS is demonstrable
      and the admin console has >1 tenant.
- [ ] Make invoices **`now`-relative** (issue/due as `daysAgo`/`daysAhead`) — hardcoded June–July 2026 dates
      decay "income this month" to R0.
- [ ] Seed `document_shares` (org→counsellor) so "shared with me" isn't empty.
- [ ] Polish: a few `audit_log`, `public_page_events`, `payments`, and `org_*_settings` rows so no
      otherwise-explorable page shows a zero-state.
- [ ] Update `docs/DEMO_LOGINS.md` with the new logins + second org.

---

## Workstream 5 — 🟡 DOCS HYGIENE

**Status:** not started.

- [ ] Rewrite `README.md` "Status" (still presents Part A as the whole product; Part B is done through 18.7).
- [ ] Fix `DESIGN.md` §5.4 nav lists to match `components/shell/nav-config.ts` (Intake→Forms,
      Calendars→Appointments, add Documents/Insights/Forms/Billing).
- [ ] Correct `SECURITY.md`: RLS is authored but **not yet enforced at runtime** (don't imply it's the live
      boundary); fix the stale "in-memory audit sink" line (audit persisted since Phase 9).
- [ ] Write the missing `docs/completed/PHASE_18.5_COMPLETE.md` and `PHASE_18.7_COMPLETE.md`; set the 18.7
      plan header to done.
- [ ] Refresh `SMOKE_TEST.md` (add forms/documents/messaging; the `/hub/reporting` reference redirects to
      Insights — note it) and add smoke steps for admin feature governance (W3).
- [ ] Keep `ROADMAP.md` in sync as each workstream lands; reconcile the `system|light|dark` vs `light|dark`
      theme note.

---

## Workstream 6 — 🟡 UX & ORG SETTINGS IA

**Status:** not started.

### 6.1 Settings page re-architecture (`app/hub/settings`)
Move from today's 5 tabs to a cleaner IA:
- [ ] **Organisation** — profile (persisted, W1.5) + **Branding** (accent + logo; `orgs.brandAccent` is already
      consumed app-wide but only settable in onboarding — add a settings surface + a logo column) + contact.
- [ ] **Booking & scheduling** — business hours, duration/buffer, **and** the booking-window rules currently
      stranded on `/hub/booking`, plus client-portal onboarding policy + public-page link. One mental model.
- [ ] **Messaging** — promote from the buried Integrations link-out to a top-level tab: channels, credits,
      templates, quiet hours, activity.
- [ ] **Billing & plan** — invoicing/VAT, own gateway, Phila plan/credits.
- [ ] **Integrations** — feature flags (now reflecting W3 platform/plan overrides), video, AI scribe.
- [ ] **Security & data** — 2FA, audit access, **data export** (POPIA subject access), **danger zone**.

### 6.2 Flow quick-wins (small, high smoothness)
- [ ] "Create invoice" CTA on session-complete → deep-link `/hub/invoicing/new?client=…&service=…` prefilled.
- [ ] Reschedule / cancel buttons in `components/client/upcoming-session-card.tsx` (actions already exist).
- [ ] Fire the `no_show` message on manual no-show mark (template already exists).
- [ ] Counsellor own-caseload capacity bar on `/app` (reuse hub's `WEEK_CAPACITY` math).
- [ ] Real session-note attachments via the documents pipeline (not local state).
- [ ] Empty-state next-step CTAs + bulk actions (multi-select reassign) across hub client/invoice lists.
- [ ] Global Cmd/Ctrl-K → New appointment (modal already exists).

---

## Workstream 7 — 🟢 NEW FEATURES (the moat)

**Status:** not started. *Each registers in the W3 feature registry, defaults OFF, admin-rollable.*
Sizes: S/M/L. Grounded in existing building blocks.

- [ ] **Outcome measures live + trends** (S) — PHQ-9/GAD-7 persisted (W1.2) with per-client trend; GAD-7 schema
      already present. *Differentiator: no SA competitor scores outcomes.*
- [ ] **No-show follow-up automation** (S) — auto-nudge/rebook using the existing `no_show` trigger.
- [ ] **Portal pay via pay-link** (S/M) — W1.3.
- [ ] **Portal reschedule/cancel** (M) — client-guarded wrappers over existing actions.
- [ ] **Sliding-scale / subsidised fees** (M) — per-client fee override on `services.priceCents` + `invoices`.
      *NGO reality; no competitor does it.*
- [ ] **Waitlist auto-fill** (L) — cancelled slot offers itself via the messaging rail; new `waitlist_entries`.
- [ ] **Referral / source tracking** (S/M) — intake already captures the field; surface in Insights breakdowns.
- [ ] **Unified client timeline** (M) — one scroll over sessions + documents + outcomes + care-plan.
- [ ] **WhatsApp-first comms as a headline** (S/M) — ensure it's prominent, not dormant-by-afterthought;
      engineer reminders into the free 24h service window where possible (marginal cost ≈ 0).
- [ ] **Funder/M&E depth** (M) — the paid differentiator: generate DSD/NLC-shaped narrative+financial report
      packs (get a real grantee template first), DQA-ready session stats.
- [ ] *(Optional, large) Medical-aid invoice formatting* — BHF practice no. + ICD-10 (with diagnosis-disclosure
      consent) + tariff code; switch integration (MediSwitch/Healthbridge) is a separate big module. Only if
      chasing paid HPCSA practitioners; **out of scope for the NGO-first core.**

---

## Workstream 8 — 🟢 MARKET / PRICING / GTM (reference, not code)

*From the 2026-07 market research. Recorded here so product decisions stay anchored.*

- **Positioning:** the only tool combining counselling case management + POPIA-native consent/audit +
  SA funder (DSD/NLC/CSI) M&E reporting + WhatsApp-first comms. No local (GoodX/Healthbridge/Bookem) or
  international (SimplePractice/Halaxy/Zanda/Cliniko) competitor covers that intersection.
- **Watch:** Halaxy (only intl. player actively marketing to SA; free core + credits); Bookem (SA,
  transparent R200–R1,495/mo, markets to psychologists, but no outcomes/M&E/WhatsApp).
- **Price ladder (indicative):** Solo **R249–349/mo** · Small practice (2–5) **R599–899/mo** · NGO site
  licence **R999–1,999/mo** (grant-cycle annual invoicing matters more than the exact number). Avoid
  %-of-collections. Lead solo/practice with WhatsApp + outcomes included (Bookem gates AI to R995, no outcomes).
- **Distribution:** SADAG partnership (highest leverage) · NACOSA (1,500+ CSOs, Global Fund sub-grants) ·
  ASCHP/PsySSA/HPCSA **CPD webinars** (bodies are CPD channels, not ad channels) · university BPsych/RC
  programmes (free student tier → converts on registration).
- **Compliance = moat:** POPIA enforcement is real and rising (DOJ R5m, Lancet R100k health-sector breach,
  WhatsApp/Meta settlement); NPO deregistration drive (15,625 deregistered by Jun 2025) makes funder
  reporting existential. Market Phila as HPCSA-safe + POPIA-native by design (neutral directory listings,
  no pay-for-ranking — HPCSA anti-canvassing).

---

## Suggested sequencing

1. **W0** (critical security) — before anything else touches real data.
2. **W1** (kill the mock) + **W3.1–3.3** (feature governance model + admin global/per-org control) — these
   pair naturally; the admin console work in W1.7 is the same surface W3 extends.
3. **W2** (security hardening) + **W3.4–3.6** (plans, quotas, credits, new-feature rollout).
4. **W4** (seed) + **W5** (docs) — cheap, unblock realistic demos/testing.
5. **W6** (UX + settings IA), then **W7** (moat features), each rolled out via W3.

## Gates (every commit)
`npx tsc --noEmit` · `npx eslint` · `npm test` (unit + contract) · `npm run build`. For DB-touching work:
migration + `meta/_journal.json` in the same commit, `IF NOT EXISTS`/`ON CONFLICT DO NOTHING` guards, RLS +
seed updated together (repo convention).

## Key files (quick map)
- Seam: `lib/data-provider.ts`, `lib/db-provider.ts`, `lib/mock/provider.ts`, `db/queries/*`.
- Features/entitlements: `lib/domain/enums.ts` → new `lib/domain/features.ts`, `lib/auth/guard.ts`
  (`requireOrgFeature`), `db/queries/settings.ts`, new `platform_feature_flags` / `org_feature_overrides` /
  plan-entitlement tables.
- Admin: `app/admin/*` (+ new `app/admin/features`), `app/admin/orgs/[id]`, `app/admin/plans`.
- Security: `lib/auth/*`, `db/client.ts`, `db/rls.sql`, `next.config.ts` (+ new `middleware.ts`),
  `app/api/webhooks/*`, `app/api/cron/reminders`, `lib/video/livekit.ts`.
- Clinical/portal: `app/app/sessions/[id]/actions.ts`, `app/app/appointments/actions.ts`,
  `components/outcomes/outcome-capture.tsx`, `app/me/*`, `components/client/invoice-list.tsx`.
- Settings/UX: `app/hub/settings/*`, `components/hub/settings-tabs.tsx`, `app/hub/booking`.
- Seed/docs: `db/seed-all.ts`, `docs/*`.
