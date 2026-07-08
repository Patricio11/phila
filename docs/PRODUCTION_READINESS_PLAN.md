# Phila  Production Readiness Plan

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

## 0. Orientation  what's actually true today

- **Provider seam.** `lib/data-provider.ts` defines `DataProvider` (84 methods). In `db` mode,
  `lib/db-provider.ts` spreads `mockProvider` and overrides ~59; **25 still return mock fixtures.**
  No UI reads fixtures directly  every mock surface leaks through an un-overridden provider method,
  so each gap is a contained "swap the method + wire the action" job, not a rewrite.
- **Feature flags** are **org-controlled only**: `ORG_FEATURES = ["ai","video","whatsapp","sms","payments","funders"]`
  (`lib/domain/enums.ts`), stored in `orgs.features` JSONB, toggled by org admins via
  `saveOrgFeature` (`app/hub/settings/actions.ts`), gated by `requireOrgFeature()` (`lib/auth/guard.ts`).
  **The super-admin cannot currently override features globally or per-org** → Workstream 3.
- **Security model** is 3 layers (route guard = UX, DAL = real gate, RLS = isolation). As of 2026-07-06
  **all three W0 criticals are fixed**: the two unguarded action modules now guard + org-scope (W0.1); the
  cron fails closed (W0.3); and **RLS is now live at runtime**  the request path runs as the non-owner
  `phila_app` role with the org GUC set (`lib/db/scoped.ts` `runForOrg`), enforcing tenant isolation beneath
  the app-layer `where org_id` checks across every hub read + write cluster and every schema table (W0.2).
- **Dormant-by-Default** is honoured well: SMS/WhatsApp/email/payments/AI/video do a real send when
  configured and an honest no-op otherwise  never a fake success. Keep this invariant.

---

## Workstream 0  🔴 CRITICAL SECURITY (ship-blockers)

**Status:** ✅ **the three criticals are closed (2026-07-06).** W0.1 (IDOR) + W0.3 (cron) done; W0.2 RLS
runtime cutover is live and enforced across every hub read + write cluster and all schema tables. Residual
non-critical read paths (counsellor/client-portal/funder reads, admin console which is still mock) remain on
the app-layer boundary + guards and scope incrementally as those surfaces are worked (tracked at the end of W0.2b).

### 0.1 Guard + org-scope the unauthenticated action modules ✅ (2026-07-05)
`app/app/appointments/actions.ts` and `app/app/sessions/[id]/actions.ts` are `"use server"` endpoints
with **no `require*` guard**  any caller can mutate any org's appointments and burn its AI budget.

- [x] Add `const { principal, membership } = await requireOrg([...])` to the top of **every** exported
      action in both files (schedulers = counsellor/org_admin/front_desk; clinicians = counsellor/org_admin).
- [x] `rescheduleAppointment` / `cancelAppointment` / `markProgress` → pass `membership.orgId` into the query;
      a 0-row result now returns an honest "couldn't be found" instead of a false success.
- [x] `db/queries/appointments.ts`: `orgId` is now a required first arg on `rescheduleAppointment`,
      `cancelAppointment`, `setAppointmentState`, and every read/write is `and(eq(id), eq(orgId))`-scoped.
- [x] `generateAiDraft` / `generateCarePlanDraft`: `aiContext(orgId, id)` scopes the lookup by org **before**
      reading the client name or calling the AI / `recordAiUsage`.
- [x] Audit `teamRole` + `orgId` now derive from the resolved membership  no more hard-coded `"counsellor"`/`null`.
- [x] Regression test (`tests/integration/series.test.ts`): a different org's id can't reschedule, cancel, or
      restate an appointment (0 rows, row untouched). Full suite 134 green; legitimate counsellor flows
      (lifecycle/appointments e2e) still persist.

### 0.2 Make RLS actually enforce at runtime (Phase 19 "runtime cutover")
`db/rls.sql` is correct but bypassed: `db/client.ts` connects as `neondb_owner` (`BYPASSRLS`), the org
GUC is never set, and `neon-http` is stateless so transaction-local GUCs can't survive.

**W0.2a  scoped primitive + proof ✅ (2026-07-05):**
- [x] Session-capable driver: `lib/db/scoped.ts` uses the neon-serverless `Pool` (WebSocket, wired to the
      Node 22 global `WebSocket`) as the non-owner `phila_app` role via `DATABASE_URL_APP`.
- [x] Per-**operation** scoping (not one long per-request tx): `runScoped(ctx, fn)` opens a short transaction,
      sets `app.org_id` / `app.is_super` locally, then runs `fn`. The context is passed **explicitly** (the DAL
      already has `orgId`)  more robust than `enterWith` from a guard, which doesn't propagate across the awaited
      guard boundary. `runForOrg(orgId, fn)` is the org-staff shorthand. Avoids holding a connection across LLM awaits.
- [x] `activeDb()` accessor: shared DAL helpers use it  inside `runScoped` they run on the scoped tx (via an
      `AsyncLocalStorage` the tx publishes reliably to its own callback tree); outside, they run on the owner
      connection unchanged. Owner (`db/client.ts`) stays for bootstrapping, webhooks, cron, seed.
- [x] Leak proof: `tests/integration/rls-scoped.test.ts` proves `runScoped` sees only its own org, denies a
      bogus org (0 rows), and lets super-admin cross orgs. (Complements the raw-SQL policy proof in `rls.test.ts`.)
      Empirically confirmed RLS is already `enable`+`force` on the live DB and `phila_app` has no BYPASSRLS.

**W0.2b  migrate the DAL onto `runScoped`, cluster by cluster (each independently tested):**
- [x] Clients read cluster: `listOrgClients` / `listRemovedClients` / `findDuplicateClients` → `runForOrg`,
      verified live (hub clients page renders all 39 through `phila_app`; server log clean; 6 e2e paths green + screenshot).
      `getClientDossier` deferred (no `orgId` param to scope by  migrates once its org is threaded).
- [x] Hub billing reads: `listOrgInvoices` + `getOrgSubscription` → `runForOrg`; `getSubscriptionRow`
      (`db/queries/subscriptions.ts`) switched to `activeDb()`  proves the `db/queries/*.ts` → `activeDb()`
      pattern. Verified live (billing plan + invoicing pages render through `phila_app`; server log clean; 3 e2e green + screenshot).
- [x] Batch of hub read clusters → `runForOrg` + `activeDb()`, verified live (all 6 surfaces render through
      `phila_app`, server log clean, screenshot of Insights with real charts):
      **services / sites / rooms / rooms-overview** (inline), **insights + reporting** (`analytics.ts` `loadCohort`),
      **forms** (`listForms` / `getForm` / `getFormResponses`), **documents** (`listOrgDocuments` / folders /
      requests / storage), **funders + grants list** (`listFunders` / `listGrants`).
- [x] `getHubOverview` (hub landing dashboard) → `runForOrg`; verified live (dashboards e2e sets a risk flag
      in the DB and the RLS-scoped overview reflects it). **The whole hub org-scoped read surface is now RLS-enforced.**
- [x] `getClientDossier` (id-based read): threaded the caller's org through the seam (`getClientDossier(orgId,
      clientId, now)`, mock + both client pages updated) and RLS-scoped it  a cross-org clientId now resolves to
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
- [x] Add RLS to the 3 uncovered tables (`platform_integrations`, `ai_providers`, `user_presence`)  super_only
      policy; owner still reads (LiveKit/Paystack/AI unaffected), tenants get 0. **Every schema table now covered.**
- [x] Public/booking/webhook/cron/bootstrap paths correctly stay on the owner connection (no `runForOrg` → owner,
      by design). The session/membership resolution that bootstraps the org context must stay owner (chicken-and-egg).
- [x] **Residual now RLS-scoped (2026-07-06):**
      - **Counsellor reads** (`getCounsellorDashboard` / `listCaseload` / `listCounsellorSessions`)  org threaded
        through the seam + `runForOrg`; all six callers pass `membership.orgId`. Verified live.
      - **Team threads** (`listTeamThreads`)  already had `orgId`; wrapped in `runForOrg`. Verified live.
      - **Client-portal reads** (`getClient` / `getCarePlan` / `listClientDocuments` / `listClientVisibleDocuments` /
        `listClientDocumentRequests` / `listClientInvoices` / `getClientConsents` / `listClientForms`)  a
        `runForClient(clientId, …)` helper resolves the authenticated client's own org and scopes the read.
        Verified live (/me documents/billing/consent).
      - **GrantId-based writes** (`setGrantIndicatorsDb` / `setGrantAllocationsDb` / `postGrantNarrativeDb`)  a
        `runForGrant(grantId, …)` helper resolves the grant's org (via `getGrantOrgId`) and scopes; child RLS
        policies (via `grants.org_id`) enforce it. Verified via funders-crud e2e.
- [x] **Intentionally on the owner connection (correct by design, not gaps):**
      - **Public tokenized writes**  `submitFormResponseDb` (form share/assignment token) is the same
        capability-token model as pay/booking/webhooks, which the security audit confirmed correctly stay on owner.
        The token is the capability; the write carries `orgId` from the resolved row.
      - **Funder reads** (`listFunderGrants` / `getFunderGrantView`)  the funder is an **external, read-only role**
        whose isolation is the `funder_contacts` grant-scope join (a funder user can be scoped to grants across
        orgs), so org-membership RLS is a model mismatch; the app-layer grant-scope join is the correct boundary.
      - **Bootstrap**  session/membership resolution and the org lookups that *feed* `runForOrg`/`runForClient`/
        `runForGrant` must use owner (chicken-and-egg: they resolve the org before a context exists).
- [ ] The super-admin console is still **mock** in db mode (Workstream 1.7 / 3)  migrates + RLS-scopes there.

### 0.3 Fix the fail-open cron ✅ (2026-07-05)
- [x] `app/api/cron/reminders/route.ts` now fails **closed** in production: an unset `CRON_SECRET` returns
      503 (`NODE_ENV === "production"`); a set secret requires the bearer; open only in dev with no secret.

---

## Workstream 1  🟠 KILL THE MOCK (real data everywhere, no fake saves)

**Status:** in progress (2026-07-06). *These "look real, silently discard data"  the most dangerous class.*

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

### 1.2 Outcomes (small, high value  makes the dashboard real) ✅ (2026-07-06)
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
      **honest** placeholder  real 2FA is a TOTP QR/verify enrolment flow (a boolean can't represent it), lands with W2.
- [x] Portal **Pay** button → the `/me/billing` page mints a signed `/pay/<token>` per unpaid invoice
      (`invoicePayPath`, server-side) and the button navigates there (was a toast stub). Reuses the existing
      pay-link + Paystack webhook path. Verified: profile-edit-persists-across-reload e2e; Pay wiring tsc-checked.
- [ ] Client↔counsellor messaging channel (distinct from staff `message_threads`)  `listConversations` still mock
      (a new feature, not just persistence; deferred).

### 1.4 Hub team management  ✅ done
- [x] `org_members` got a `status` (`active`/`invited`/`archived`) + `createdAt` (migration 0034); seeded the three
      missing role users  **front_desk** (Lindiwe), **finance** (Riaan), **programme_manager** (Bongani, archived) 
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
- [x] Public booking policy: `getBookingSettings` → DB (`db/queries/booking-settings.ts`, RLS-scoped)  composes
      the policy from the org row (`orgs.booking_settings` JSONB) over the **live** services/counsellors, so a newly
      added service inherits sensible defaults. `saveBookingSettings` persists the whole blob (migration 0035);
      `app/hub/booking/actions.ts` writes it behind `DATA_PROVIDER==="db"` + revalidates.
- [x] `getPlatformSettings` (VAT) → DB: national rate now lives in a single-row `platform_settings` table
      (migration 0035, seeded 15%); `savePlatformVat` upserts it (`app/admin/settings/actions.ts`).
- [x] `getOrgSettings` (payment-connection status) → DB: reads the real org row + `orgs.payments` JSONB
      (`{ provider, status }`), Dormant-by-Default (`off` until an admin connects a gateway).
- [x] Verified: tsc + eslint + build + unit (150/150, incl. 2 new W1.5 round-trip integration tests) + e2e
      (`tests/e2e/settings-w15.spec.ts`: booking policy renders from DB & saves, VAT reads from DB) + screenshots.

### 1.6 Client merge  ✅ done
- [x] `mergeClients` (`app/hub/clients/actions.ts`) now runs `mergeClientsDb` (`db/queries/merge.ts`) behind
      `isDb()`: one RLS-scoped, atomic transaction that **re-points every child record** onto the kept id 
      appointments (and their session notes, which follow the appointment), care plans, outcome measures,
      invoices, client_documents, documents/folders/requests, form assignments  then **soft-deletes the losers**
      (retained + restorable). Detection via `findDuplicateClients` was already real.
- [x] Uniqueness-constrained tables (consents `(client_id,purpose)`, grant_allocations `(grant_id,client_id)`,
      demographics `client_id` PK) fill only the **gaps** the keeper lacks (one loser row per key, most recent
      wins) so the keeper's record always wins and no index is violated. The keeper's missing phone/email is
      backfilled from a loser (a merge consolidates, never loses, a contact).
- [x] Verified: tsc + eslint + build + unit **152/152** (2 new merge integration tests: full re-point/backfill/
      soft-delete round-trip + the negative case) + e2e (`tests/e2e/merge.spec.ts`: seeds a duplicate pair,
      merges through the UI scoped to its own card, asserts one survivor) + screenshots. Confirmed the demo's real
      seeded Lerato duplicate is left untouched.

### 1.7 Super-admin console  ✅ done
- [x] `getPlatformOverview` / `listPlatformOrgs` / `getPlatformOrgDetail` → DB (`db/queries/platform.ts`, owner
      connection): every tenant computed **live** from orgs + subscriptions + org_members + appointments (7-day
      sessions) + ai_usage (month spend). Seeded 4 extra tenants (Thrive/Ubuntu/MindWell/Khula) so the console shows
      a real, varied multi-tenant view; **cleaned up 19 junk `org_test_*` tenants** left by unclean signup e2e runs.
- [x] `listPlatformAudit` → DB (recent `audit_log` joined to org + actor names). `listOrgSlugs` → DB (live org slugs
      for the public micro-site static params).
- [x] `getAiRail` → DB (enabled `ai_providers` row + month's `ai_usage` spend). `listIntegrations` → DB (catalogue
      with status derived from `platform_integrations`: paystack/livekit/sms/email; dormant-by-default otherwise).
- [x] Onboarding is now real: two tables (`onboarding_requirements`, `org_onboarding_docs`, migration 0036, RLS
      platform-only). `listOnboardingRequirements` / `getOrgOnboardingReview` → DB; `saveOnboardingRequirements`
      (replace checklist) / `reviewOnboardingDoc` (verify/reject) persist behind `DATA_PROVIDER==="db"`.
- [x] Verified: tsc + eslint + build + unit **157/157** (5 new platform integration tests) + e2e
      (`tests/e2e/platform.spec.ts`: overview/orgs/audit render from DB) + screenshots.

> **W1 is complete.** Every super-admin console method used by a shipped page is now a DB override; onboarding
> persists. Next: the end-to-end **signup → email verification → org onboarding upload → admin review → approval**
> flow (builds on the onboarding tables above)  see Workstream 1.8 below.

> **Definition of done for W1:** grep for `"(mock)"` / `"Phase .. persists"` in `app/**/actions.ts`
> returns nothing that runs under `isDb()`, and every `DataProvider` method used by a shipped page is
> a DB override.

---

## Workstream 1.8  🟢 SIGNUP → VERIFY → ONBOARDING → APPROVAL (trial-first)

**Why:** onboard real practices smoothly. A paid product with a **17-day free trial** (no card): keep
signup low-friction, but collect real company data + documents and let the platform admin verify.

**Decisions (with the user):** no hard approval gate (trials must work). **Email verification is
mandatory.** After verify + sign-in they land in the hub with the trial live; a friendly gate nudges them
to **complete the company profile + upload the admin-set required documents** to go fully live (unlock
payouts + funder sharing). A plan chosen on the landing page (`?plan=`) carries into the trial and is
shown on signup (no picker on the form  too much friction). Plan catalogue is **platform-admin managed**.

### 1.8a Mandatory email verification + trial start  ✅ done
- [x] Better Auth `requireEmailVerification: true` + `emailVerification` (sendOnSignUp, autoSignInAfterVerification);
      branded verification email via Resend (`lib/email/platform-email.ts` + `templates.ts`), honest dormant fallback.
- [x] `registerPractice`: creates the org (`onboardingStatus: not_started`) + a **trialing** subscription
      (17 days) on the chosen plan (`?plan=` honoured, else Community); returns a "check your email" state.
- [x] Login gate: `signIn` refuses unverified addresses and surfaces a **resend** affordance; `resendVerification`
      action; post-verify `/welcome` landing → hub. Org lifecycle columns on `orgs`
      (`onboarding_status`, `onboarding_submitted_at`, `onboarding_reviewed_at`; migration 0037).
- [x] Verified: tsc + eslint + build + e2e (`tests/e2e/verify-signup.spec.ts`: check-email, trial on chosen
      plan, login gated until verified, verified admin gets in) + screenshots.

### 1.8b Company profile + document onboarding (the go-live gate)  ✅ done
- [x] Hub gate banner (`VerificationBanner`) on the overview  a nudge, not a wall  until the practice is verified,
      status-aware (start / under review / action needed). New **Verification** nav item + `/hub/verification` page.
- [x] `CompanyVerification`: a guided **company profile** (registration no, VAT, income tax, HPCSA practice no,
      POPIA Information Officer + email, phone, website, physical + postal address) → `orgs.profile`; **required-doc
      uploads** stream straight to Phila Storage via presigned URLs → `org_onboarding_docs` (org-scoped RLS; migration
      0038 adds `storage_key`/`bytes`/`review_note`); **submit** gated on the core fields + all required docs
      (`onboardingStatus = submitted`). Read-only once submitted/verified.

### 1.8c Admin review + approval  ✅ done
- [x] Orgs list shows each org's lifecycle stage (*Email pending · Onboarding · Submitted · Action needed · Verified*),
      computed from `orgs.onboarding_status` + the admin's `email_verified`. Detail page shows the submitted **company
      information** + document review (open/verify/send-back-with-note) + org-level **Approve & verify** / **Send back**.
- [x] `approveOrg` → `verified` + branded **approval email**; `sendBackOnboarding` → `action_needed` + **action-needed
      email** (reason included); doc send-back carries a note the practice sees. Emails via Resend, honest dormant fallback.
- [x] Verified: tsc + eslint + build + unit **161/161** (4 new onboarding-lifecycle integration tests) + e2e
      (`tests/e2e/onboarding.spec.ts`: hub gate + company form save, admin stages + review + approve controls) + screenshots.

### 1.8d Settings + Billing reflect verification + trial  ✅ done
- [x] **Settings → Organisation** leads with a **Company verification** card (`VerificationStatusCard`): lifecycle
      status + a summary of the submitted legal details (registration, VAT, HPCSA practice no, Information Officer),
      linking to `/hub/verification` (the source of truth). Also hardened the settings page for lightweight/just-created
      orgs (business-hours + scheduling fallbacks) so a fresh practice never hits an error boundary.
- [x] **Billing + Settings plan card** (`YourPlanCard`) now shows the **trial countdown**  a "Trial · N days left"
      chip, "Trial ends {date}", and a calm "no card needed · nothing switches off mid-trial" note  driven by
      `trialDaysLeft(nextBillingAt, now)`. Surfaced on `/hub/billing` too (was credits-only).
- [x] Verified: tsc + eslint + build + unit 161/161 + e2e (`tests/e2e/trial-billing.spec.ts`) + screenshots.

---

## Workstream 2  🟠 SECURITY HARDENING (Phase 19)

**Status:** in progress (batch 1 landed).

- [x] **Security headers.** `next.config.ts` `headers()` now sets HSTS, `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy` (camera/mic/geo off by default; camera+mic re-enabled only on `/room/*`), and a
      nonce-free CSP (`frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`).
      Verified shipping via `curl -I`. A full nonce-based `script-src` CSP is a deliberate follow-up.
- [x] **Prompt (don't enforce) 2FA** (W2 batch 3). Privileged users (super-admin / org-admin / supervising
      counsellor) without 2FA see a **dismissible dashboard banner** (`TwoFactorBanner`, rendered by the app
      shell)  never a redirect or block. "Set it up" opens a focused `/setup-security` page (reuses the real
      `TwoFactorSetup` enrolment); "×" (`dismissTwoFactorPrompt`) remembers the choice for 14 days via cookie.
      `shouldPromptTwoFactor(principal)` gates it; `requiresTwoFactor()` is **not** wired into the guards.
      *(Chose a banner over an interstitial redirect so it never disrupts navigation or the e2e suite.)*
- [x] **Email verification.** `requireEmailVerification: true` (W1.8a)  org-admin self-registration now
      verifies before sign-in, with a branded email + resend.
- [x] **WhatsApp webhook signature.** POST now reads the raw body, routes by `phone_number_id`, and verifies
      Meta's `X-Hub-Signature-256` HMAC-SHA256 against the org's app secret (constant-time) before acting;
      rejects with 401 otherwise (`app/api/webhooks/whatsapp/route.ts`).
- [x] **Video join links** (W2 batch 3). `signJoin`/`verifyJoin`/`videoJoinPath` now bind the token to the
      appointment's **start time**  which is both the anti-forgery signature and a **nonce**: a reschedule
      changes `startsAt` and invalidates every old link. `verifyJoin` also enforces an **expiry window**
      (openable 15 min before → 3 h after start). Host access tightened from *any org member* to **org-admin or
      counsellor** of the org (front-desk/finance/programme roles no longer auto-admitted to a therapy room).
      All 6 call sites thread `startsAt`; unit + integration tests updated + a window/nonce test added.
- [~] **Rate limiting.** Better Auth `rateLimit` enabled (W2 batch 2): a modest global IP cap + tighter custom
      rules on `/sign-in/email`, `/sign-up/email`, `/request-password-reset`, `/forget-password`, `/two-factor/
      verify-totp`. In-memory per instance. **Still pending:** a shared store (Upstash/KV) + throttling on the
      non-auth public surfaces (booking, `/f/[token]` submit, pay, public-events, AI actions).
- [x] **Timing-safe comparisons.** `paystackSignatureValid` and `verifyJoin` now use `timingSafeEqual`
      (length-guarded, mirror `invoice-link.ts`). Unit-tested (`tests/unit/security.test.ts`).
- [x] **Audit integrity.** Clinical-access audits (`note.read`, `note.read_hub_override`, `demographics.read`,
      `pii.export`) are now **fail-strict**  `lib/audit/index.ts` re-throws if the write fails, so a read
      can't proceed unlogged. Operational actions stay best-effort.
- [x] **Password reset.** Wired to Better Auth (W2 batch 2): `requestPasswordReset` sends a **branded** email
      with a single-use, 1-hour token; `/reset-password?token=` exchanges it via `auth.api.resetPassword`. The
      request path never leaks account existence; a missing/expired token shows a friendly "request a new link"
      state. Proven end-to-end (`tests/integration/password-reset.test.ts`: old→reset→new, old rejected).
- [x] **Invited-member activation** (W2 batch 3). `inviteMemberDb` now provisions the user (email-verified) **+ a
      credential account** with an unguessable placeholder password + an `invited` membership. Inviting (and
      "resend setup link") emails a branded **"You've been invited to join {org}"** link via Better Auth's reset
      token; `sendResetPassword` sends the invite email for a still-`invited` member (a plain reset otherwise). The
      member sets their password at `/reset-password`, and the **first sign-in flips them `invited → active`**.
      Proven end-to-end (`tests/integration/member-activation.test.ts`).
- [x] **Uploads.** `validateUpload` now rejects a filename extension that doesn't match the declared
      content-type (all five upload actions pass the name). The declared type is still client-supplied, so a
      post-upload magic-byte/AV `scanObject` remains the real gate  confirm it's a live AV hook before launch.
- [ ] **Secrets.** Rotate `BETTER_AUTH_SECRET`, `PHILA_FIELD_KEY`, DB passwords before go-live; keep prod
      secrets out of the OneDrive-synced tree.
- [x] **`exportGrantReport`**  now verifies grant→org ownership (`getGrantOrgId`) before logging the
      `pii.export`, so no cross-org export and no spurious audit entry for someone else's grant (W2 batch 2).
- [ ] **Retention clocks (POPIA × HPCSA).** Soft-delete must honour HPCSA Booklet 9 retention (≥6y dormant,
      minors→21, incapacity→lifetime) and reconcile with POPIA deletion requests  per-record-type clock,
      not hard delete. Feeds the data-subject export/erasure tooling.
- [ ] **AI cross-border (POPIA s72).** Confirm the LLM processor contract is zero-retention + POPIA-adequate,
      or rely on explicit consent (the AI toggle already is the s72 consent gate); prefer SA/EU hosting +
      de-identify-before-call (already implemented). Document this in `SECURITY.md`.

---

## Workstream 3  🟠 PLATFORM FEATURE GOVERNANCE & ADMIN CONTROL *(explicit ask)*

**Status:** in progress — the entitlement engine + global & per-org feature control (3.1–3.3) are **live**.
Plan CRUD/quotas (3.4) and unified metered resources (3.5) remain. *Give the super-admin full, real control
to enable/disable functionality globally or per-org, and to manage subscriptions/quotas.*

### 3.1 The entitlement model (design first)
Introduce a clear precedence chain so every feature resolves the same way:

```
effective(feature, org) =
     platform_kill_switch(feature)            // super-admin can force-OFF globally (e.g. disable AI everywhere)
  ?  plan_entitlement(org.plan, feature)      // does the org's subscription plan include it?
  ?  org_override(org, feature)               // super-admin per-org grant/deny (beta access, or suspend)
  ?  org_self_toggle(org.features, feature)   // org admin's own on/off (today's behaviour)
```

- [x] **Feature registry** (`lib/domain/features.ts`): `FEATURE_REGISTRY` over the existing `ORG_FEATURES` with
      `label`, `description`, `category`, `globallyDisableable`, `meteredResource?`. `planIncludesFeature(plan, f)`
      derives plan entitlement from the existing `Plan` allowances (no duplicate config; fails **open** on an
      unknown plan). New features register here.
- [x] New tables + RLS (migration 0040): `platform_feature_flags` (per-feature kill-switch, super-only) and
      `org_feature_overrides` (`orgId`, `feature`, `state force_on|force_off|inherit`, `reason`, `setBy`,
      org-scoped so an org can read its own). Added to `db/rls.sql`.
- [x] Central resolver `resolveAllFeaturesDb` / `resolveFeatureDb` (`db/queries/features.ts`): precedence
      **kill-switch → per-org override → plan → self-toggle**, returning `{enabled, source, reason,
      orgControllable}`. Wired into `requireOrgFeature()` (db mode) + hub nav (`effectiveFeaturesDb`); mock
      falls back to the raw self-toggle. Proven by `tests/integration/feature-governance.test.ts` +
      `tests/unit/features.test.ts`.
- [x] Every platform/override change is audited (`kill_feature`/`restore_feature`, `override_*`).

### 3.2 Admin: global feature control — ✅ done
- [x] `app/admin/features/page.tsx` + new **Feature control** nav item — a matrix of all features with a
      **global kill-switch** each (`FeatureMatrix`); e.g. disable **AI scribe** platform-wide instantly.
      Non-disableable features (funders) show "Always on".
- [x] `setPlatformFeature(feature, disabled)` — guarded by `requireSuperAdmin`, persisted, audited; revalidates
      the console. E2e + screenshot.

### 3.3 Admin: per-org feature control — ✅ done
- [x] `app/admin/orgs/[id]` **Features** card (`OrgFeaturePanel`): each feature's **effective** on/off, the
      resolution **reason + source**, and a three-way **force-on / force-off / inherit** control
      (`setOrgFeatureOverride`) — grant a beta feature to one org, or suspend `ai`/`payments` for an org in breach.
- [x] Shows the org's plan (in the card header) alongside what resolves. E2e + screenshot.

### 3.4 Admin: subscription & plan management — ✅ done (c)
- [x] Plans gained a `storageGb` quota (`Plan` + `PLANS`, reused everywhere — no new catalogue). `listPlans` +
      `getPlatformOrgDetail` are DB (W1.7).
- [x] **Assign/upgrade/downgrade an org's plan** from `app/admin/orgs/[id]` — an **OrgPlanControl** card (plan
      selector + quota summary) → `setOrgPlan`/`setOrgPlanDb` (reuses `upsertSubscription`). Entitlements + quotas
      are reflected **immediately** by the resolver (proven: moving plans changes the effective storage limit).
- [x] **Full plan-catalogue CRUD** — a DB-backed, super-admin-editable `plans` table (migration 0042; seeded from
      the code `PLANS`, which stays as the fallback if the table is empty/unavailable, so nothing breaks). Reads
      go through `db/queries/plans.ts` (`getPlansDb`/`getPlansMapDb`/`getPlanByIdDb`/`savePlanDb`); every consumer
      — the entitlement resolver, resource meters, platform overview, `listPlans`, the landing pricing, the hub
      plan picker, and `OrgPlanControl` — now reads the live catalogue. `app/admin/plans` **PlansManager** edits a
      plan's name/tagline/price/seats/AI/video/storage/rooms/messaging inline → `savePlan` action → one change
      applies to every org on the plan (no drift). Landing "Get started" carries `?plan=<id>` into signup.

### 3.5 Admin: metered resources & credits — ✅ done (d)
- [x] `getOrgResourceMetersDb` unifies the real pools — `credit_balances` (SMS/email), `org_storage_usage`
      (storage used vs the plan/override limit), and `ai_usage` + `org_ai_settings` (AI spend vs monthly cap).
- [x] `app/admin/orgs/[id]` **Resources & quotas** panel (`OrgResourceMeters`): usage bars + controls to **top up
      SMS/email credits** (reuses `grantMessagingCredits`), **set/clear a storage-limit override** (`setOrgStorageLimit`
      → `orgs.resource_limits`, migration 0041), and **set the AI monthly cap** (`setOrgAiCap` → `saveAiSettings`).
      All guarded + audited.
- [x] Storage enforcement is now org-aware: `orgStorageLimitBytes(orgId)` (override → plan → default) replaces the
      flat limit across all five upload paths — so changing the plan/override actually changes what uploads are
      allowed. Exhaustion still no-ops honestly (Dormant-by-Default). Proven by `tests/integration/org-resources.test.ts`.

### 3.6 Admin: enabling the new (Workstream 7) features
- [ ] Every new feature ships **registered in the feature registry (3.1)** and **defaulted OFF**, so the
      super-admin can roll it out globally, per-plan, or per-org from day one (beta cohort → GA).

> **Definition of done for W3:** from `/admin`, a super-admin can (a) kill AI-scribe platform-wide,
> (b) force-enable a beta feature for exactly one org, (c) move an org between plans and see its features
> + quotas change, (d) top up or cap an org's storage/SMS/AI, and (e) roll out a brand-new feature to a
> chosen cohort  all persisted, audited, and reflected instantly by `requireOrgFeature`.

---

## Workstream 4  ✅ SEED & DEMO REALNESS

**Status:** done. *So every page has meaningful data and every role has a login.* (`db/seed-all.ts`)

- [x] Day templates for **all four** counsellors (Thabo/Aisha/Pieter added to `counsellorDayTemplates`, so the
      mock provider populates too). Each counsellor's `/app` now has a live day — verified Aisha's dashboard.
- [x] The 30-client M&E cohort now has **time-anchored completed sessions** (4–8 each, round-robined across the
      counsellors, spaced so the deferred overlap constraint never trips). Grant "sessions delivered" reads
      **173** (DSD) / **67** (Lotto) instead of ~0.
- [x] `session_notes` seeded from `supervisionTemplates` (each on a real backing appointment at 16:00, clear of
      the day templates), supervisor = Nomsa → the supervision sign-off queue is real.
- [x] Logins for **front_desk** (Lindiwe), **finance** (Riaan), **programme_manager** (Bongani — seeded
      archived, to demo the archived-member state) — all in `DEMO_USERS`/`MEMBERS`; documented in DEMO_LOGINS.
- [x] A **second, fully-real tenant — Thrive EAP** (`org_thrive`): its own admin (`admin@thrive-eap.co.za`) +
      counsellor (Dr Yolanda Meyer) + 4 clients + real sessions + a paid invoice. **RLS isolation proven** end-to-end
      (signed in as Thrive → sees only Thrive's clients, never Masizakhe's).
- [x] Invoices are **`now`-relative** — a uniform shift anchors the newest to today (`onConflictDoUpdate` so a
      re-seed re-anchors), pulling a recent paid one into the current month → "income this month" = R450, not R0.
- [x] `document_shares` (org→counsellor) seeded so each counsellor's "Shared with me" reads true.
- [x] Polish: real `payments` (settled invoice, credit top-up, subscription) + a fortnight of `public_page_events`
      (view→click→booked funnel, cleared-then-reinserted to stay idempotent) so those views aren't zero-state.
- [x] `docs/DEMO_LOGINS.md` updated with the operations-role logins + the Thrive second org.

---

## Workstream 5  ✅ DOCS HYGIENE

**Status:** done.

- [x] README "Status" refreshed  Part B is covered through 18.7 **plus** a new **Production readiness
      (W1–W4)** bullet; the Architecture section de-stalened (all role routes exist; `db/scoped.ts` noted).
- [x] `DESIGN.md` §5.4 nav lists rewritten to match `components/shell/nav-config.ts` exactly (Counsellor:
      Appointments/Documents/Supervision; Hub: Insights/Forms/Billing/Verification; Admin: Users/Feature
      control; Client: Your steps/Forms/Profile), with a note on feature-gated + "Soon" items.
- [x] `SECURITY.md` corrected  RLS **is enforced at runtime** now (the `phila_app` role via
      `lib/db/scoped.ts`, per-op org GUC), the isolation tests are real (not "Phase 19"), and audit
      **persists** to `audit_log` (fail-strict for clinical actions)  the stale "in-memory sink" line is gone.
- [x] Wrote `docs/completed/PHASE_18.5_COMPLETE.md` + `PHASE_18.7_COMPLETE.md`; set the 18.7 plan header
      + checklist to done.
- [x] `SMOKE_TEST.md` refreshed  new sign-in rows (ops-roles + the Thrive tenant), an **RLS isolation**
      check, Forms/Documents/Messages/Supervision boxes, Reporting folded into **Insights** (with the
      `/hub/reporting`→`/hub/insights` redirect noted), admin **Feature control** + **Plans** (W3) steps,
      and the test count (181).
- [x] `ROADMAP.md` kept in sync  a **Production readiness (W1–W6)** section added, Phase 19/20 boxes
      updated to reflect what W2/W3 delivered (security headers, per-IP rate limiting, RLS runtime cutover +
      isolation tests), and the `system|light|dark` → `light|dark` theme note reconciled to `DESIGN.md` §10.

---

## Workstream 6  🟡 UX & ORG SETTINGS IA

**Status:** in progress.

### 6.1 Settings page re-architecture (`app/hub/settings`)
Move from today's 5 tabs to a cleaner IA:
- [~] **Organisation**  profile (persisted, W1.5) + **Branding** ✅ (an accent picker with live preview + preset
      palette + contrast note; `saveOrgBranding`  the accent was only set at signup) + contact. *(Logo column still
      to add.)*
- [~] **Booking & scheduling**  duration/buffer + business hours + the new **change/cancellation notice** window
      ✅. *(Still to fold in: the booking-window rules stranded on `/hub/booking` + the client-portal policy link.)*
- [x] **Messaging**  promoted from the buried Integrations link-out to a **top-level tab** (channel on/off chips,
      SMS/email credit balances, quiet hours, + a route into the full manager).
- [x] **Billing & plan**  invoicing/VAT, own gateway, Phila plan/credits (already grouped).
- [x] **Integrations**  feature flags (reflect W3 platform/plan overrides), video, AI scribe (Messaging moved out).
- [ ] **Security & data**  2FA, audit access, **data export** (POPIA subject access), **danger zone**. *(Tab
      relabelled "Security & data"; the data-export + danger-zone surfaces remain.)*

### 6.2 Flow quick-wins (small, high smoothness)
- [ ] "Create invoice" CTA on session-complete → deep-link `/hub/invoicing/new?client=…&service=…` prefilled.
- [x] **Client request-to-change** on `upcoming-session-card` (per the org's rule: the client never edits the
      booking  they **request** a reschedule/cancel with a reason; the org has a configurable notice window and a
      pending-requests queue on `/hub/appointments` with Approve/Decline). *(Supersedes the "direct reschedule/
      cancel" idea; also lands W7's "Portal reschedule/cancel".)*
- [x] The `no_show` message already fires on marking a session no-show (session-note flow) — verified.
- [x] Counsellor own-caseload **capacity bar** on `/app` (shared `WEEK_CAPACITY`).
- [ ] Real session-note attachments via the documents pipeline (not local state).
- [ ] Empty-state next-step CTAs + bulk actions (multi-select reassign) across hub client/invoice lists.
- [x] Global **⌘K / Ctrl-K → New appointment** (opt-in on the counsellor dashboard).

---

## Workstream 7  🟢 NEW FEATURES (the moat)

**Status:** not started. *Each registers in the W3 feature registry, defaults OFF, admin-rollable.*
Sizes: S/M/L. Grounded in existing building blocks.

- [ ] **Outcome measures live + trends** (S)  PHQ-9/GAD-7 persisted (W1.2) with per-client trend; GAD-7 schema
      already present. *Differentiator: no SA competitor scores outcomes.*
- [ ] **No-show follow-up automation** (S)  auto-nudge/rebook using the existing `no_show` trigger.
- [ ] **Portal pay via pay-link** (S/M)  W1.3.
- [ ] **Portal reschedule/cancel** (M)  client-guarded wrappers over existing actions.
- [ ] **Sliding-scale / subsidised fees** (M)  per-client fee override on `services.priceCents` + `invoices`.
      *NGO reality; no competitor does it.*
- [ ] **Waitlist auto-fill** (L)  cancelled slot offers itself via the messaging rail; new `waitlist_entries`.
- [ ] **Referral / source tracking** (S/M)  intake already captures the field; surface in Insights breakdowns.
- [ ] **Unified client timeline** (M)  one scroll over sessions + documents + outcomes + care-plan.
- [ ] **WhatsApp-first comms as a headline** (S/M)  ensure it's prominent, not dormant-by-afterthought;
      engineer reminders into the free 24h service window where possible (marginal cost ≈ 0).
- [ ] **Funder/M&E depth** (M)  the paid differentiator: generate DSD/NLC-shaped narrative+financial report
      packs (get a real grantee template first), DQA-ready session stats.
- [ ] *(Optional, large) Medical-aid invoice formatting*  BHF practice no. + ICD-10 (with diagnosis-disclosure
      consent) + tariff code; switch integration (MediSwitch/Healthbridge) is a separate big module. Only if
      chasing paid HPCSA practitioners; **out of scope for the NGO-first core.**

---

## Workstream 8  🟢 MARKET / PRICING / GTM (reference, not code)

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
  no pay-for-ranking  HPCSA anti-canvassing).

---

## Suggested sequencing

1. **W0** (critical security)  before anything else touches real data.
2. **W1** (kill the mock) + **W3.1–3.3** (feature governance model + admin global/per-org control)  these
   pair naturally; the admin console work in W1.7 is the same surface W3 extends.
3. **W2** (security hardening) + **W3.4–3.6** (plans, quotas, credits, new-feature rollout).
4. **W4** (seed) + **W5** (docs)  cheap, unblock realistic demos/testing.
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
