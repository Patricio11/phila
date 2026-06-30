# Phase 9  Identity, Auth & Consent ✅

*Shipped: 2026-06-29 · Part B · the mock→real swap proven, with real accounts, 2FA, and persisted consent*

> Goal: real accounts for every role, multi-tenant sessions, lawful (persisted)
> consent, and audit  all **behind the unchanged Part-A UI**. `DATA_PROVIDER=db`
> over Neon Postgres. Identity is the foundation the rest of Part B clips onto.

---

## What shipped

### Database + Better Auth (the foundation)
- **Neon Postgres** connected (`DATABASE_URL` + generated secrets in `.env.local`, gitignored). Schema in
  `db/schema.ts` + `db/auth-schema.ts`: Better Auth tables (`user`, `session`, `account`, `verification`,
  `two_factor`) + tenancy (`orgs` with features/scheduling JSONB, `org_members`), `consents`, `audit_log`.
  **Text ids match the fixtures**, so the seed mirrors Part A and the hybrid's mock fallback == real reads.
- **Better Auth** (email+password) over the Drizzle/Neon adapter; API at `/api/auth/[...all]`; sessions in
  Postgres; `nextCookies()` sets cookies from Server Actions.
- **Seed** (`npm run db:seed`, idempotent): the demo org + config, 8 users (hashed passwords), memberships,
  and 32 consents. Demo accounts in `docs/DEMO_LOGINS.md` (all `phila1234`).

### Identity behind the unchanged UI
- `getCurrentPrincipal()` resolves the **real session** → the same `Principal` shape (memberships joined from
  the DB). **Zero call-site changes.** Every guard resolves real identity; unauthenticated → `/login`.
- The **login form** does real sign-in with **role-based routing**; demo buttons are one-click real logins.

### Real sign-up
- **`registerPractice`** creates the first **org_admin** (Better Auth signs them in) + their **org** (unique
  slug) + membership, then routes to onboarding. New orgs start Dormant-by-Default.

### Consent  persisted (Consent-Before-Capture)
- 32 consents seeded; **`getClientConsents` reads the DB**; the consent centre's toggle calls a real
  **`setConsent`** action that upserts the versioned `consents` row (grant bumps the version; revoke keeps it)
  and audits. A change survives a reload  proven by E2E.

### Audit  persisted
- `logAccess()` now writes to **`audit_log`** when `DATA_PROVIDER=db` (swappable sink, no call-site change).
  75+ rows accumulated during testing. Never fails the user's action.

### 2FA (TOTP)
- Better Auth **twoFactor plugin** + `two_factor` table. **Enrolment UI** in Security settings (confirm
  password → scan QR + backup codes → verify a 6-digit code). **Sign-in challenge** appears **only for users
  who enabled it** (gated by Better Auth's `twoFactorRedirect`); a non-enrolled user signs in straight through.
  Disable flow included.

### The seam: hybrid `dbProvider`
- Spreads `mockProvider`, overrides `getOrg` / `getOrgBySlug` / `getClientConsents` with real DB reads, falls
  back to mock elsewhere  the app stays whole as it migrates method-by-method.

## Verification
- `tsc` clean · `next build` green (`DATA_PROVIDER=db`) · `lint` clean.
- **45 unit/contract** tests green. **9 Playwright E2E** green with screenshots in `/screenshots`:
  login per role, wrong-password, guard redirect, **consent persists across reload**, **real sign-up →
  onboarding**, and the **full 2FA loop** (enrol → sign-out → challenge → verify → in; gated).
- DB confirms it's real: 75 `audit_log` rows; sessions + 2FA secrets persisted.

## Deferred (not blocking Phase 10)
- Email verification + forgot/reset **delivery** (Phase 12 notifications)  flows exist, sending is dormant.
- Org switcher for multi-org users. Backup-code sign-in path (TOTP path is wired + tested).

**Phase 9 is complete. Next: Phase 10  the full entity schema + seed-everything + RLS, migrating the read
clusters off the mock fallback.**
