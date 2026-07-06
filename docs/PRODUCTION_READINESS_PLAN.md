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
- **Security model** is 3 layers (route guard = UX, DAL = real gate, RLS = isolation). As of 2026-07-06
  **all three W0 criticals are fixed**: the two unguarded action modules now guard + org-scope (W0.1); the
  cron fails closed (W0.3); and **RLS is now live at runtime** — the request path runs as the non-owner
  `phila_app` role with the org GUC set (`lib/db/scoped.ts` `runForOrg`), enforcing tenant isolation beneath
  the app-layer `where org_id` checks across every hub read + write cluster and every schema table (W0.2).
- **Dormant-by-Default** is honoured well: SMS/WhatsApp/email/payments/AI/video do a real send when
  configured and an honest no-op otherwise — never a fake success. Keep this invariant.

---

## Workstream 0 — 🔴 CRITICAL SECURITY (ship-blockers)

**Status:** ✅ **the three criticals are closed (2026-07-06).** W0.1 (IDOR) + W0.3 (cron) done; W0.2 RLS
runtime cutover is live and enforced across every hub read + write cluster and all schema tables. Residual
non-critical read paths (counsellor/client-portal/funder reads, admin console which is still mock) remain on
the app-layer boundary + guards and scope incrementally as those surfaces are worked (tracked at the end of W0.2b).

### 0.1 Guard + org-scope the unauthenticated action modules ✅ (2026-07-05)
`app/app/appointments/actions.ts` and `app/app/sessions/[id]/actions.ts` are `"use server"` endpoints
with **no `require*` guard** — any caller can mutate any org's appointments and burn its AI budget.

- [x] Add `const { principal, membership } = await requireOrg([...])` to the top of **every** exported
      action in both files (schedulers = counsellor/org_admin/front_desk; clinicians = counsellor/org_admin).
- [x] `rescheduleAppointment` / `cancelAppointment` / `markProgress` → pass `membership.orgId` into the query;
      a 0-row result now returns an honest "couldn't be found" instead of a false success.
- [x] `db/queries/appointments.ts`: `orgId` is now a required first arg on `rescheduleAppointment`,
      `cancelAppointment`, `setAppointmentState`, and every read/write is `and(eq(id), eq(orgId))`-scoped.
- [x] `generateAiDraft` / `generateCarePlanDraft`: `aiContext(orgId, id)` scopes the lookup by org **before**
      reading the client name or calling the AI / `recordAiUsage`.
- [x] Audit `teamRole` + `orgId` now derive from the resolved membership — no more hard-coded `"counsellor"`/`null`.
- [x] Regression test (`tests/integration/series.test.ts`): a different org's id can't reschedule, cancel, or
      restate an appointment (0 rows, row untouched). Full suite 134 green; legitimate counsellor flows
      (lifecycle/appointments e2e) still persist.

### 0.2 Make RLS actually enforce at runtime (Phase 19 "runtime cutover")
`db/rls.sql` is correct but bypassed: `db/client.ts` connects as `neondb_owner` (`BYPASSRLS`), the org
GUC is never set, and `neon-http` is stateless so transaction-local GUCs can't survive.

**W0.2a — scoped primitive + proof ✅ (2026-07-05):**
- [x] Session-capable driver: `lib/db/scoped.ts` uses the neon-serverless `Pool` (WebSocket, wired to the
      Node 22 global `WebSocket`) as the non-owner `phila_app` role via `DATABASE_URL_APP`.
- [x] Per-**operation** scoping (not one long per-request tx): `runScoped(ctx, fn)` opens a short transaction,
      sets `app.org_id` / `app.is_super` locally, then runs `fn`. The context is passed **explicitly** (the DAL
      already has `orgId`) — more robust than `enterWith` from a guard, which doesn't propagate across the awaited
      guard boundary. `runForOrg(orgId, fn)` is the org-staff shorthand. Avoids holding a connection across LLM awaits.
- [x] `activeDb()` accessor: shared DAL helpers use it — inside `runScoped` they run on the scoped tx (via an
      `AsyncLocalStorage` the tx publishes reliably to its own callback tree); outside, they run on the owner
      connection unchanged. Owner (`db/client.ts`) stays for bootstrapping, webhooks, cron, seed.
- [x] Leak proof: `tests/integration/rls-scoped.test.ts` proves `runScoped` sees only its own org, denies a
      bogus org (0 rows), and lets super-admin cross orgs. (Complements the raw-SQL policy proof in `rls.test.ts`.)
      Empirically confirmed RLS is already `enable`+`force` on the live DB and `phila_app` has no BYPASSRLS.

**W0.2b — migrate the DAL onto `runScoped`, cluster by cluster (each independently tested):**
- [x] Clients read cluster: `listOrgClients` / `listRemovedClients` / `findDuplicateClients` → `runForOrg`,
      verified live (hub clients page renders all 39 through `phila_app`; server log clean; 6 e2e paths green + screenshot).
      `getClientDossier` deferred (no `orgId` param to scope by — migrates once its org is threaded).
- [x] Hub billing reads: `listOrgInvoices` + `getOrgSubscription` → `runForOrg`; `getSubscriptionRow`
      (`db/queries/subscriptions.ts`) switched to `activeDb()` — proves the `db/queries/*.ts` → `activeDb()`
      pattern. Verified live (billing plan + invoicing pages render through `phila_app`; server log clean; 3 e2e green + screenshot).
- [x] Batch of hub read clusters → `runForOrg` + `activeDb()`, verified live (all 6 surfaces render through
      `phila_app`, server log clean, screenshot of Insights with real charts):
      **services / sites / rooms / rooms-overview** (inline), **insights + reporting** (`analytics.ts` `loadCohort`),
      **forms** (`listForms` / `getForm` / `getFormResponses`), **documents** (`listOrgDocuments` / folders /
      requests / storage), **funders + grants list** (`listFunders` / `listGrants`).
- [x] `getHubOverview` (hub landing dashboard) → `runForOrg`; verified live (dashboards e2e sets a risk flag
      in the DB and the RLS-scoped overview reflects it). **The whole hub org-scoped read surface is now RLS-enforced.**
- [x] `getClientDossier` (id-based read): threaded the caller's org through the seam (`getClientDossier(orgId,
      clientId, now)`, mock + both client pages updated) and RLS-scoped it — a cross-org clientId now resolves to
      no rows instead of fetch-then-discard. Verified live (hub dossier renders through `phila_app`).
- [x] Remaining hub **id-based reads**: `getRoomDetail(orgId, …)` + `getGrantView(orgId, …)` threaded through
      the seam and RLS-scoped (mock + pages updated). Verified live (room + grant detail render full data through
      `phila_app`; grant M&E computes correctly). Every hub id-based read is now scoped.
- [x] **All hub write clusters** on `runForOrg` (WITH CHECK / USING enforce cross-org rejection at the DB):
      **clients** (create/bulk/update/remove/reassign), **org-config** (business hours, client-portal, scheduling,
      feature flags), **catalogue** (services/rooms/sites), **M&E** (funder + grant create/update/delete + grant admin),
      **forms** (create/update/status/share/send/booking-intake), **documents** (folders/move/assign/visibility/
      soft-delete/share/request/upload/finalize). Verified live across catalogue, funders-crud, hub-consistency,
      forms-share, and documents e2e + the documents integration test (which now exercises the writes through `phila_app`).
- [x] Add RLS to the 3 uncovered tables (`platform_integrations`, `ai_providers`, `user_presence`) — super_only
      policy; owner still reads (LiveKit/Paystack/AI unaffected), tenants get 0. **Every schema table now covered.**
- [x] Public/booking/webhook/cron/bootstrap paths correctly stay on the owner connection (no `runForOrg` → owner,
      by design). The session/membership resolution that bootstraps the org context must stay owner (chicken-and-egg).
- [x] **Residual now RLS-scoped (2026-07-06):**
      - **Counsellor reads** (`getCounsellorDashboard` / `listCaseload` / `listCounsellorSessions`) — org threaded
        through the seam + `runForOrg`; all six callers pass `membership.orgId`. Verified live.
      - **Team threads** (`listTeamThreads`) — already had `orgId`; wrapped in `runForOrg`. Verified live.
      - **Client-portal reads** (`getClient` / `getCarePlan` / `listClientDocuments` / `listClientVisibleDocuments` /
        `listClientDocumentRequests` / `listClientInvoices` / `getClientConsents` / `listClientForms`) — a
        `runForClient(clientId, …)` helper resolves the authenticated client's own org and scopes the read.
        Verified live (/me documents/billing/consent).
      - **GrantId-based writes** (`setGrantIndicatorsDb` / `setGrantAllocationsDb` / `postGrantNarrativeDb`) — a
        `runForGrant(grantId, …)` helper resolves the grant's org (via `getGrantOrgId`) and scopes; child RLS
        policies (via `grants.org_id`) enforce it. Verified via funders-crud e2e.
- [x] **Intentionally on the owner connection (correct by design, not gaps):**
      - **Public tokenized writes** — `submitFormResponseDb` (form share/assignment token) is the same
        capability-token model as pay/booking/webhooks, which the security audit confirmed correctly stay on owner.
        The token is the capability; the write carries `orgId` from the resolved row.
      - **Funder reads** (`listFunderGrants` / `getFunderGrantView`) — the funder is an **external, read-only role**
        whose isolation is the `funder_contacts` grant-scope join (a funder user can be scoped to grants across
        orgs), so org-membership RLS is a model mismatch; the app-layer grant-scope join is the correct boundary.
      - **Bootstrap** — session/membership resolution and the org lookups that *feed* `runForOrg`/`runForClient`/
        `runForGrant` must use owner (chicken-and-egg: they resolve the org before a context exists).
- [ ] The super-admin console is still **mock** in db mode (Workstream 1.7 / 3) — migrates + RLS-scopes there.

### 0.3 Fix the fail-open cron ✅ (2026-07-05)
- [x] `app/api/cron/reminders/route.ts` now fails **closed** in production: an unset `CRON_SECRET` returns
      503 (`NODE_ENV === "production"`); a set secret requires the bearer; open only in dev with no secret.

---

## Workstream 1 — 🟠 KILL THE MOCK (real data everywhere, no fake saves)

**Status:** in progress (2026-07-06). *These "look real, silently discard data" — the most dangerous class.*

### 1.1 Clinical (highest user impact) ✅ (2026-07-06)
- [x] `getSession` → real DB override assembling the editor payload (appointment, client, consent, note,
      care plan, outcomes, continuity) from the clinical tables, RLS-scoped; orgId threaded through the seam.
- [x] `signNote` → persists body + signature to `session_notes`; **real debounced autosave** (`saveNoteDraft`)
      so a draft survives navigate-away (the "autosave" was previously a local indicator only).
- [x] `shareCarePlan` → `shareCarePlanDb` upserts + stamps `sharedAt`.
- [x] `addCarePlanStep` → `addCarePlanStepDb` appends a real task (returns its id), creating the plan if absent.
- [x] Supervision: `getSupervisionQueue` / `getSupervisionOverview` are DB overrides; `signOffNote` persists the
      decision + comment (migration 0030 added the supervisor sign-off columns). Authorised by the supervisor link.
      Verified across integration tests for notes, care plans, and supervision + a note-persist-across-reload e2e.

### 1.2 Outcomes (small, high value — makes the dashboard real) ✅ (2026-07-06)
- [x] `components/outcomes/outcome-capture.tsx` `save()` now calls a real `recordOutcome` action
      (`app/app/sessions/[id]/actions.ts`) → `createOutcomeMeasureDb` (`db/queries/outcomes.ts`) writes
      `outcome_measures` via `runForOrg` (the RLS child policy rejects a cross-org client). The component takes
      `clientId` and `router.refresh()`es so the dashboard sparkline + reporting update. Verified: integration test
      (persist + cross-org rejection) and an e2e that records a PHQ-9 in the session editor and reads score=9 back
      from Postgres.

### 1.3 Client portal ✅ (2026-07-06, except client↔counsellor chat)
- [x] `getClientProfile` + `listAppointmentsForClient` → DB overrides (RLS-scoped via `runForClient`, now shared
      in `lib/db/scoped.ts`). The `/me` profile + sessions pages read real data.
- [x] `saveClientProfile` → persists name/phone/email (columns) + the extras (DOB, address, emergency, preferred
      channel) to `clients.profile` jsonb (migration 0033). `changeClientPassword` → **real** via Better Auth
      (`auth.api.changePassword`, verifies current pw + revokes other sessions). `setClientTwoFactor` kept an
      **honest** placeholder — real 2FA is a TOTP QR/verify enrolment flow (a boolean can't represent it), lands with W2.
- [x] Portal **Pay** button → the `/me/billing` page mints a signed `/pay/<token>` per unpaid invoice
      (`invoicePayPath`, server-side) and the button navigates there (was a toast stub). Reuses the existing
      pay-link + Paystack webhook path. Verified: profile-edit-persists-across-reload e2e; Pay wiring tsc-checked.
- [ ] Client↔counsellor messaging channel (distinct from staff `message_threads`) — `listConversations` still mock
      (a new feature, not just persistence; deferred).

### 1.4 Hub team management — ✅ done
- [x] `org_members` got a `status` (`active`/`invited`/`archived`) + `createdAt` (migration 0034); seeded the three
      missing role users — **front_desk** (Lindiwe), **finance** (Riaan), **programme_manager** (Bongani, archived) —
      so every role is represented with real data.
- [x] `listTeam` / `getTeamMemberDetail` → DB (`db/queries/team.ts`, RLS-scoped via `runForOrg`); `TeamMemberView`
      now carries `status`, live `caseload`, and `counsellorId` (lets a quick role edit mirror the supervisor flag).
- [x] `saveTeamMember` / `setMemberStatus` (archive/restore) / `inviteTeamMember` / `sendSetupLink`
      (`app/hub/team/actions.ts`) → persist membership + role through the provider seam; audited; revalidate `/hub/team`.
- [x] **Team page redesign** (the "make some magic" ask): a `RoleGuide` legend (all five roles, exactly what each
      reaches + the one thing it can never touch), Active/Invited/Archived tabs with counts, search, and rich per-row
      actions (Open, Manage role & access, Resend invite, Archive/Restore) via a row menu. Beautiful + smooth.
- [x] Verified: tsc + eslint + build + unit (147/148, one pre-existing parallel-flake) + e2e round-trip
      (`tests/e2e/team.spec.ts`: roster, role guide, archive→restore) + screenshots.

### 1.5 Org / platform settings (stop discarding saves)
- [x] `saveOrgProfile` → persists to `orgs.profile` (migration 0031); **hardcoded fake registration/practice
      numbers removed** from the settings page (now reads the real profile). Verified via e2e.
- [x] `saveInvoiceSettings` → persists VAT/banking/invoice-prefix to `orgs.invoice_settings` (migration 0032);
      `getInvoiceSettings` is a DB override merged over defaults. Same proven JSONB pattern as the profile.
- [x] Public booking policy: `getBookingSettings` → DB (`db/queries/booking-settings.ts`, RLS-scoped) — composes
      the policy from the org row (`orgs.booking_settings` JSONB) over the **live** services/counsellors, so a newly
      added service inherits sensible defaults. `saveBookingSettings` persists the whole blob (migration 0035);
      `app/hub/booking/actions.ts` writes it behind `DATA_PROVIDER==="db"` + revalidates.
- [x] `getPlatformSettings` (VAT) → DB: national rate now lives in a single-row `platform_settings` table
      (migration 0035, seeded 15%); `savePlatformVat` upserts it (`app/admin/settings/actions.ts`).
- [x] `getOrgSettings` (payment-connection status) → DB: reads the real org row + `orgs.payments` JSONB
      (`{ provider, status }`), Dormant-by-Default (`off` until an admin connects a gateway).
- [x] Verified: tsc + eslint + build + unit (150/150, incl. 2 new W1.5 round-trip integration tests) + e2e
      (`tests/e2e/settings-w15.spec.ts`: booking policy renders from DB & saves, VAT reads from DB) + screenshots.

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
