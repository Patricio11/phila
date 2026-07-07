# Phila  Security & POPIA model

Read this before touching `lib/auth/*`, `db/schema.ts`, `db/rls/*` (Part B), or adding any
protected page. Phila holds the most sensitive class of personal data there is  mental-health
notes, race, employment status, sometimes GBV survivors. Under POPIA all of it is **special personal
information**. Consent, field-level encryption, audit logging, and right-to-erasure are built in from
commit one and never retrofitted.

## The three-layer model

Authorisation is defence in depth. No single layer is trusted alone.

1. **Route guard  the UX layer.** `lib/auth/guard.ts` (`requireAuth`, `requireOrg`,
   `requireCapability`, `requireOrgFeature`, `requireFunderGrant`). It decides what a user is *shown*
   and renders honest blocked states. It is **not** the security boundary  it runs where the request
   is shaped and can be bypassed by a forged request.
2. **The Data Access Layer  the real gate.** All reads/writes go through typed query functions
   (`db/queries/*`, Part B). No raw queries in components. Every mutation is a Server Action validated
   with Zod. Every PII path calls `logAccess()`. Select-list redaction keeps `session_notes.body`,
   contact details, `national_id_enc`, and demographics off any shared/cross-role payload.
3. **Postgres Row-Level Security  the isolation boundary.** This is the layer that actually stops a
   tenant from reading another tenant's rows. Every `org_id` table has an RLS policy keyed off the
   authenticated org + role. Even a bug in layers 1–2 cannot leak across orgs, because the database
   itself refuses the row. Policies are **authored, applied, proven, and enforced at runtime**: the request
   path connects as the non-owner `phila_app` role (no `BYPASSRLS`) through `lib/db/scoped.ts`, which opens a
   short transaction per operation and sets the org GUC (`app.org_id`) locally so the policies in `db/rls.sql`
   bind on every live query. The owner connection (`db/client.ts`) keeps `BYPASSRLS` only for bootstrapping
   (session/membership resolution), webhooks, cron, and seed. RLS is a real second boundary **beneath** the
   DAL's app-layer `where org_id = …`  defence in depth, not either-or.

> **Rule of thumb:** if removing the route guard would leak data, the design is wrong. The guard is
> for experience; the DAL and RLS are for safety.

## Tenant isolation (RLS)

- Shared database, `org_id` on every tenant-scoped row.
- A request carries an authenticated org context; RLS policies compare `org_id` to that context.
- `super_admin` cross-org access and impersonation go through an **explicit, audited** path  never
  an implicit policy hole. Each crossing writes an `audit_log` row (`impersonate.start` / `.end`).
- Integration tests (`tests/integration/rls.test.ts`, `rls-scoped.test.ts`) assert that a query scoped to
  org A cannot read org B's rows through the `phila_app` role, that notes never appear in a cross-role
  payload, and that a funder can reach only their own grant's aggregates.

## Clinical-note confidentiality (the core rule)

- The **private clinical note** (`session_notes`) is readable freely only by the **authoring
  counsellor and their supervisor**. `lib/auth/roles.ts#resolveNoteAccess` encodes this.
- The **Hub (org_admin)** *can* reach a note, but that access is **audited**  a recorded event,
  never silent (`note.read_hub_override`). Front desk, finance, and programme managers can never read
  a note at all.
- The note is **never** the same artifact as the **shared care plan** (`care_plans`). Sharing with a
  client is a deliberate, consented action that never exposes the private note.

## Consent (lawful basis)

- Versioned, purpose-bound, with a strict state machine (`none → granted(v) → revoked`) in
  `lib/consent`. Purpose-bound reads (demographics, AI processing, funder reporting, comms) call
  `assertConsent()` at the boundary.
- The org-level **AI toggle is also the POPIA s.72 cross-border consent gate**: off means nothing
  leaves. AI inference de-identifies before any cross-border call, uses a zero-data-retention
  provider, and never stores audio (Data-Residency Rule).

## Cryptography & residency

- Field-level encryption (AES-256-GCM, `lib/crypto`) for SA ID numbers and other special fields. Key
  from `PHILA_FIELD_KEY` (env/KMS). In production a missing key is fatal  we never store plaintext.
- Client PII rests in an **SA region** (AWS `af-south-1` / Azure SA North) before public launch. The
  swap is `db/client.ts` only (driver-agnostic Drizzle).

## Audit (Protected & Audited Rule)

- `logAccess()` is invoked on every PII read/export and privileged action, and **persists to the
  `audit_log` table** (since Phase 9/10). Clinical actions are on a fail-strict list  a failed audit
  write re-throws rather than letting the action proceed silently unlogged (`lib/audit`).

## k-anonymity (funder / aggregate exports)

- Any aggregate or funder export applies a **k-anonymity floor** (default 5) with small-cell
  suppression (`applyKAnon`). Suppressed cells are labelled "too few to report", never dropped
  silently. A funder is external, read-only, scoped to their grant(s), sees only k-anon aggregates,
  and every view is audited  a funder can never re-identify a client.
