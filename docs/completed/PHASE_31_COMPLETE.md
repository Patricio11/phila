# ✅ Phase 31 complete — Compliance & data-subject readiness (POPIA × HPCSA)

*Closed 2026-07-21. Plan: `docs/PHASE_31_COMPLIANCE_PLAN.md`. Five clusters, each a
verified green commit. Governing principle held throughout: zero new steps in the
daily loop; correct by default; view-first admin surfaces; platform carries the
paperwork; one-click on demand.*

## What shipped

**31.2 · Retention core** (`00aeaa0`) — `lib/compliance/retention.ts`: computed
HPCSA-aware clocks (≥6y from last entry; minors→21, later clock wins; incapacity
indefinite), `erasureDecision` (honoured-where-lawful / refused-with-dated-reason /
blocked-under-hold), all constants in one file for a one-line advisor correction;
11 unit tests. `lib/compliance/subprocessors.ts` (the s72 register). `clients.legal_hold`
(migration 0054 — applied via the reconciled `npm run db:migrate`).

**31.1 · DSAR** (`c653821`) — one-click **export** (identity, appointments, note
*metadata*, care plan, consents, demographics, outcomes, documents, invoices, the
access audit, retention status → portable JSON); **erasure** de-identifies immediately
and holds the clinical record under its clock where mandated; **legal hold** set/lift;
the quiet **Data & privacy** card on the client detail; `/me` **"Your data, your
rights"** routing requests to the practice. `dsar.export`/`dsar.erase` join the
fail-strict audit class. Integration-proven against Neon + live e2e on both surfaces.

**31.2 · Pruner** (`120df4c`) — `/api/cron/retention`: report-only by default,
destruction only with explicit `RETENTION_PRUNER_MODE=destroy`; never inside a clock
or under hold; destroys clinical children + pseudonymises (appointments kept
pseudonymised — Outcome-Honesty); fail-strict audited. Integration-proven (report
lists lapsed-only; destroy spares fresh + held).

**31.3/31.4 · Breach register + POPIA pack** (`3f3e0e4`) — `/admin/compliance`:
log → contain → notified → closed, **who-was-affected** derived from the audit trail
+ a drafted s22 notice (never auto-sent); the sub-processor register rendered
read-only. **`/reports/popia`**: the one-click printable pack (consents by purpose,
12-month audit shape + trail, retention posture, breach entries, s72 chain) — its own
generation is a fail-strict `pii.export` that appears in the pack it produces.
"Download compliance pack" button in Settings → Security & data. Migration 0055
(breach_log, super-only RLS).

**31.5/31.6 · Paperwork + sweep** (this commit) — `docs/compliance/` (DPIA,
IO checklist, DPA register), the dismissible **IO nudge** (Settings → Security &
data; stored on the org profile), the SECURITY.md erasure-vs-retention policy, and
the **compliance sweep** (`tests/integration/compliance-sweep.test.ts`): funder
payload carries no client PII + suppression proven live in-payload; "AI-generated"
label locked; AI layer can't sign/send/advance state; the messaging rail has no
risk-flag pathway; companion suites (k-anon, retention, DSAR, pruner, RLS) must exist.

## Verification
`tsc` · `eslint` · `next build` green per cluster; **222 vitest** at close (11
retention units + 3 integration suites + the 5-part sweep added); live e2e screenshots
for the Data & privacy panel, the client rights card, the admin console, and a real
65-consent / 2,531-event Masizakhe pack.

## Honest constraints carried forward
- HPCSA numbers + the operator/responsible-party framing need advisor sign-off before
  launch (all encoded in `lib/compliance/*` for one-line correction).
- Data residency (SA region) stays Phase 19, gated to first-real-client onboarding.
- Phila's own IO registration + advisor DPIA review are open items in
  `docs/compliance/IO_CHECKLIST.md` / `DPIA.md`.
