# Phase 9.0 — Real auth + DB-backed identity ✅

*Shipped: 2026-06-28 · Part B (first slice) · the mock→real swap, proven end-to-end*

> Goal of the slice: stand up the real database + authentication and resolve the
> **real principal from Postgres behind the unchanged UI** — proving Part B is a
> swap, not a rewrite. `DATA_PROVIDER=db`. This is the foundation every other real
> method builds on (identity first).

---

## What shipped

### Database (Neon Postgres)
- **Connected** a Neon project; `DATABASE_URL` + generated secrets in `.env.local` (gitignored).
- **Schema** (`db/schema.ts` + `db/auth-schema.ts`): Better Auth tables (`user`, `session`, `account`,
  `verification`) + tenancy (`orgs` with features/scheduling JSONB, `org_members` → user), `consents`,
  `audit_log`. **Text ids that match the mock fixtures** (e.g. `org_masizakhe`) so the seed mirrors Part A
  exactly and mock-fallback reads agree with real reads.
- **Migrations**: two journaled migrations generated + applied to Neon (`db/migrations/`).
- **Seed** (`db/seed.mjs`, `npm run db:seed`): idempotent (`ON CONFLICT DO NOTHING`) — the demo org + its
  config + 8 users (hashed passwords via Better Auth) + memberships. Re-runnable; refreshes org config.

### Authentication (Better Auth)
- **Email + password** over the Drizzle/Neon adapter (`lib/auth/better-auth.ts`), API handler at
  `/api/auth/[...all]`, browser client (`lib/auth/client.ts`). Phila identity rides on the user as
  `platform_role` + `client_id`; org membership + team role live in `org_members`.
- **Sessions persisted** in Postgres; the `nextCookies()` plugin sets the cookie from Server Actions.

### Identity behind the unchanged UI
- `lib/auth/session.ts` `getCurrentPrincipal()` now resolves the **real session** → builds the same
  `Principal` shape from the DB (memberships joined from `org_members` + `orgs`). **Zero call-site changes.**
- Every guard (`requireAuth`/`requireOrg`/`requireHub`/`requireClient`/`requireFunder`/`requireSuperAdmin`/
  `requireCapability`/`requireOrgFeature`) resolves real identity; **unauthenticated → redirect to `/login`**.
- The **login form** does real Better Auth sign-in with **role-based routing** (counsellor→/app, hub→/hub,
  client→/me, funder→/funder, super-admin→/admin); the demo buttons are now **one-click real logins**.

### The seam: hybrid `dbProvider`
- `lib/db-provider.ts` spreads `mockProvider` as the base and **overrides one method at a time** with a real
  DB read — `getOrg` / `getOrgBySlug` are live; everything else falls back to the mock. Because the DB is
  seeded from the same fixtures, **fallback and real reads are identical**, so the app stays whole while it
  migrates method-by-method through the rest of Part B.

## Verification
- `tsc` clean · `next build` green with `DATA_PROVIDER=db` · **45 unit/contract tests** green (conformance
  updated for the hybrid; `server-only` stubbed for vitest).
- **6 Playwright E2E** green (`tests/e2e/auth.spec.ts`): real login for all four roles → correct home, a
  wrong password rejected by Better Auth, and an unauthenticated visit redirected to `/login`. **Screenshots
  in `/screenshots`** as proof — the Hub shows *"Good evening, Thandeka · Org admin · Masizakhe Counselling"*,
  all resolved live from Postgres. 4 real `session` rows were written during the run.

## Demo logins
See **[docs/DEMO_LOGINS.md](../DEMO_LOGINS.md)** — every demo account, its role, and the shared password.

## Still open in Phase 9 (next slices)
- Seed **all** fixtures into the DB (full entity schema) + migrate the read clusters off mock.
- **Consent** state machine persisted + **audit** persisted on PII paths.
- Sign-up creating real orgs/users; **2FA (TOTP)** for super-admin / org-admin / supervisors; org switcher;
  verification + forgot/reset emails (Phase 12 notifications).

**Identity is real. The rest of Part B clips onto this, method by method.**
