# Phase 10  The Data Engine ✅

*Shipped: 2026-06-29 · Part B · the whole product runs on Neon  reads **and** writes persist, with a proven RLS boundary*

> Goal: the schema, tenant isolation, and integrity everything stands on  the
> mock→db swap. `DATA_PROVIDER=db` runs the product on Neon Postgres behind the
> unchanged Part-A UI. Built cluster-by-cluster on a **hybrid `dbProvider`** that
> spreads the mock and overrides per cluster; the DB is seeded from the *same*
> fixtures (`db/seed-all.ts`), so mock-fallback and real reads always agree.

---

## What shipped

### Reads  every authenticated surface reads real rows
The hybrid `dbProvider` overrides (the rest delegate to the mock):
- **Org/tenancy:** `getOrg`, `getOrgBySlug`, `getClientConsents`
- **Directory:** `listClients`, `getClient`, `listCounsellors`, `getCounsellor`, `listServices`, `listSites`, `listRooms`
- **Appointments:** `listCounsellorSessions`, `listAppointmentsForCounsellor`, `listAppointmentsForOrg`
- **Clinical:** `getCarePlan`, `listClientDocuments`
- **Billing:** `listClientInvoices`, `listOrgInvoices`
- **Funders:** `listFunders`, `listFunderGrants`
- **Composite dashboards:** `getHubOverview` + `getCounsellorDashboard` aggregate DB rows through pure,
  unit-tested `compute*` functions in `lib/domain/dashboards.ts` (calendar + home read the *same* appointments)
- **Caseload:** `listCaseload`  live clients + their real appointments (new bookings / marked sessions show up)

The only mock-delegated reads left are the seeded M&E aggregates (`getReporting`, `getGrantView`,
`getFunderGrantView`). Nothing writes those tables at runtime yet, so via the shared seed they're identical;
they migrate with **Phase 16** (funder tools), which write grants/indicators/allocations/demographics.

### Writes  the product saves data now (the `db/queries/*` typed layer)
Server Actions → typed query fns → DB, Zod-validated + audited. Four clusters persist, each with a DB-write E2E:
- **Bookings** (`db/queries/booking.ts`)  a public booking auto-registers the client, allocates a free room
  (no double-booking), creates the scheduled appointment, and records versioned consent  all real rows.
- **Catalogue** (`db/queries/catalogue.ts`)  services / rooms / sites (replace = upsert kept + delete removed).
- **Appointment lifecycle** (`db/queries/appointments.ts`)  create (with weekly recurring series), reschedule,
  mark completed/no-show/cancelled.
- **Settings / care / invoicing** (`db/queries/settings.ts`)  mark-invoice-paid, care-step task toggle,
  business hours.

### Row-Level Security (Task 10.2)  authored, applied, **proven**
- `db/rls.sql` (idempotent; `npm run db:rls` via `db/apply-rls.ts`): a non-owner **`phila_app`** role
  (no `BYPASSRLS`), `ENABLE`+`FORCE` RLS on **every** org-scoped table  13 with a direct `org_id` policy,
  `orgs` by `id`, the clinical children (`care_plans`/`demographics`/`outcome_measures`) via `clients.org_id`,
  the M&E children (`grant_allocations`/`indicators`/`narratives`) via `grants.org_id`, `session_notes` via
  `appointments.org_id`, and `funder_contacts` via `funders.org_id`. Policies key off `app_current_org()` /
  `app_is_super()` request GUCs; the super-admin escape is explicit + audited.
- **Proof:** `tests/integration/rls.test.ts` connects **as `phila_app`** and asserts deny-by-default
  (no context → 0 rows), per-org isolation (no cross-org read), correct own-org visibility, **cross-org INSERT
  rejected by `WITH CHECK`**, and super-admin cross-org access.
- The owner (migrations/seed/auth) keeps `BYPASSRLS`, so RLS is inert for those paths and the E2Es stay green.

---

## Tests
- **56 unit / contract / RLS** (Vitest)  incl. the provider-conformance surface, dashboard math, k-anon
  reporting invariants, and the 5-test RLS leak proof.
- **21 Playwright E2E** (chromium)  every read cluster + a DB-write proof for booking, catalogue, lifecycle,
  invoicing, and the live caseload; screenshots in `/screenshots`.
- `tsc` + `eslint` clean. 17 Drizzle migrations on Neon.

---

## Deliberately deferred (not Phase-10 work  re-scoped to where they belong)
This keeps Phase 10 honest: it's the data engine, not a dumping ground for every later feature's schema.
- **RLS runtime cutover** + **select-list redaction** → **Phase 19** (security hardening). RLS is enforced at
  the DB *now*; activating it on the live request path (connect as `phila_app` + per-request org GUC via the
  neon-serverless WebSocket Pool  mechanism verified) is a deliberate pass. Until then the app-layer
  `where org_id = …` is the primary, in-place boundary.
- **Payments** tables → **Phase 15** · **Comms** tables → **Phase 12** · **AI** tables → **Phase 14** ·
  **`org_public_pages`** → with the editable-public-page feature. (Empty tables nothing reads/writes = busywork.)
- **Storage** (private buckets, signed URLs, magic-byte sniff, audited file access) → **Phase 14** with the
  clinical documents feature. Document *metadata* already persists + reads from `client_documents`.
- **`room_assignments` / `recurring_series`** → **Phase 11** (scheduling engine). Performance indices tuned
  there too, once query shapes are final.
- **Seeded M&E reads** (`getReporting` / grant views) → **Phase 16** (funder tools that write those tables).

**Done when (met):** `DATA_PROVIDER=db` runs the whole product on Neon with no UI churn, every cluster's reads
+ writes persisting, and the tenant boundary proven in Postgres.
