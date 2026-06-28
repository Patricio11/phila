# PHASE 9 PLAN  Identity, Auth & Consent (Part B begins)

*The first Part-B phase. Goal: real accounts, all roles, multi-tenant sessions, and lawful consent  wired
**behind the Part-A UI without changing it**. The conformance + unit suites are the regression guard; if they
go red while wiring, a contract broke.*

> Read with `ROADMAP.md` §9, `PHASE_A_CLOSEOUT.md` (the gate, now met), `SECURITY.md` (the three-layer model),
> and `docs/completed/PHASE_A_COMPLETE.md`. Stack: Next 16 · Better Auth · Drizzle · Neon Postgres.

---

## 0. Prereqs (carry in from the closeout)
- [x] `dataProvider` seam total; conformance suite green; clock + adapters in place.
- [ ] Neon project + a **Postgres `app` role** (NOT owner / NOT BYPASSRLS)  every request connects as it.
- [ ] `.env`: `DATABASE_URL` (app role), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

## 1. Better Auth setup
- [ ] Better Auth + Drizzle adapter; email + password + verification; **forgot/reset** (the Part-A screens
  already exist  wire the actions to real flows). Sessions persisted in Postgres.
- [ ] **Role model:** platform (`super_admin | client | funder`) + org `team_role`
  (`org_admin | counsellor | front_desk | finance | programme_manager`, +`supervisor`). Multi-org membership
  resolution + org switcher.
- [ ] Server-Action **sign-in routes by role** (counsellor → `/app`, admin → `/hub`, client → `/me`,
  funder → `/funder`, super-admin → `/admin`).
- [ ] **2FA (TOTP)** for `super_admin`, `org_admin`, and supervising counsellors.

## 2. Back the guards with real identity
*The guards already exist and return a mock identity; swap the body, keep the signature.*
- [ ] `requireAuth` / `requireOrg` / `requireHub` / `requireClient` / `requireFunder` / `requireSuperAdmin` /
  `requireCapability` / `requireOrgFeature` read the **real session + membership**.
- [ ] `requireFunderGrant` scopes a funder to their grant(s), read-only.

## 3. Sign-up + activation flows (wire the Part-A screens)
- [ ] **Practice sign-up** (`/signup`) creates the org + first `org_admin`; routes into onboarding.
- [ ] **Team invite + `/activate`** (role-aware)  counsellor/admin set a password from the invite link.
- [ ] **Client invite + auto-register-at-booking**  set-password link over the org's configured channel;
  `/activate` lands them in `/me`.
- [ ] **Onboarding** persists practice basics + working hours; **document uploads** stage to storage (Phase 14)
  and surface in `/admin/orgs/[id]` for review; verification state gates payouts + funder sharing.

## 4. Consent persistence (Consent-Before-Capture, for real)
- [ ] `consents` table: `(org_id, client_id, purpose, state, version, updated_at)`; the state machine in
  `lib/consent` becomes the writer.
- [ ] booking / notes / demographics / AI / comms / care-plan-share / **funder_reporting** each independently
  granted + revoked; the consent centre (`/me/consent`) writes through.
- [ ] Every purpose-bound read calls `assertConsent` at the boundary (already wired in the UI paths).

## 5. Audit persistence
- [ ] `audit_log` table; `logAccess()` (already called everywhere) **persists**; `/admin/audit` + the Hub
  note-access override read from it.

## 6. Tests (run against **real ephemeral Postgres as the app role**)
*These were held back in Part A on purpose  a pass against the mock proves nothing.*
- [ ] **Role-guard integration**  each guard admits/denies the right principals.
- [ ] **Consent enforcement**  a purpose-bound read with no active grant is refused.
- [ ] (Cross-org RLS isolation lands with Phase 10 schema; written then.)
- [ ] The **Part-A conformance + unit suites stay green** the whole time.

## Done when
Real auth + consent back the Part-A UIs **unchanged**; sign-in routes every role; every PII read writes an
audit row; the Part-A suites are still green and the new Phase-9 integration tests pass against a real DB
connected as the app role.
