# PART A  COMPLETE ✅

*Shipped: 2026-06-28 · Phila · the whole product on mock, hardened for the swap into Part B*

> Goal of Part A: build the **entire** counselling-practice platform  every role, every surface  on a
> clean `dataProvider` seam, mock-first, so that Part B becomes a **swap, not a rewrite**. POPIA-first,
> SA-context, English-only, light/dark. Part A is now the demo-ready, test-guarded baseline for Part B.

---

## What Part A delivers (all five roles)

**Counsellor (`/app`).** Today dashboard (honest stat cards, schedule, outcomes, attention); a **world-class
calendar** (Day/Week/Month/Agenda, navigation, proportional time-grid, click-to-create, drag-to-reschedule,
appointment-detail with inline reschedule/mark/cancel + room-conflict check; closed days **blocked**); the
**client dossier** (attendance/in-care/outcome stats, care plan, session history, consent-gated demographics);
the **session workspace** (live private note + **"Since last time"** continuity + SOAP/DAP/Brief scaffolds +
AI-draft→sign + outcome capture + share care plan); **sessions list** (stats + filters + search); **internal
team messaging**; **supervision** (sign-off workflow, Hub-assigned); **rooms** ("your week" grid); a real
**account settings** (profile, 2FA, password).

**Hub / org admin (`/hub`).** Overview (clients + **income actual/predicted by day/week/month**, new-clients,
**staffing load**); oversight calendars; **clients** (add / **import CSV** / **merge-dedupe** / reassign /
the Hub client page with **full clinical-note access**, audited); **team** (invite, manage role/supervisor/
active, the **member profile page**, send-setup-link); **rooms** (CRUD, utilisation, assign counsellor, room
schedule); **intake**; **invoicing** (paid/unpaid/**overdue**, mark-paid, **A4 preview**); **reporting**
(consent-gated, **k-anon**, funder narrative, real CSV export); **funders & grants**; **settings**
(organisation profile, security, **working hours editor**, **BYO messaging channels**, BYO payments, public
page). Plus **client invites** over WhatsApp/SMS/email.

**Client (`/me`, mobile-first).** Home (next-session hero with **live countdown + add-to-calendar**, crisis
support, steps progress); **"Your steps"**  interactive, gently-gamified between-session tasks (tick + warm
achievements; two-sided with the counsellor); sessions, documents, billing, consent centre; **profile**
(details + emergency contact + security). Plus the public booking flow with **auto-register at booking**.

**Funder (`/funder`).** Scoped, read-only portfolio + per-grant dashboards (k-anon, audited).

**Super admin (`/admin`).** Platform overview; **organisations** (+ the org detail with **member directory**
and **onboarding-document review** / verification); **onboarding requirements** (the platform defines the
docs every practice must upload); plans & billing; AI rail; integrations; audit ledger.

**Auth / onboarding (the first impression).** Branded `AuthShell`; **sign-in**, **practice sign-up**,
**forgot/reset password**; the **onboarding wizard** (practice → hours → **verification documents** → done);
a **role-aware `/activate`** for invited clients and team. All mock; real auth is Phase 9 behind these screens.

---

## The seam + the rules (made into code)

- **One `dataProvider` interface**, fully typed with final signatures; `mockProvider` implements it;
  `dbProvider` is a throwing stub; `DATA_PROVIDER=mock|db` switch. **Zero `@/lib/mock` imports** in app +
  components (entity types + pure helpers live in `lib/domain`).
- **POPIA spine, live from commit one:** the consent state machine; `logAccess()` on every PII path; the
  private clinical note vs the shared care plan; demographics only when consented; funder data aggregate +
  **k-anon** (small cells suppressed, labelled). The Hub owns the record (full access, audited); each
  counsellor is scoped to their own caseload.
- **Dormant-by-Default:** AI / video / WhatsApp / SMS / payments are off until configured  typed
  **adapter interfaces** (`lib/adapters/`) are the Part-B attach points, honest mocks until then.

## Closeout hardening (the swap-not-rewrite gate)

- **Provider-conformance suite** (`tests/contract/`)  mock & db expose an identical surface; the stub
  throws; the k-anon / consent / funder-scoping / soft-delete invariants hold. Runs against `dbProvider`
  in Part B unchanged.
- **Vitest unit suite** on the pure logic that carries into Part B (`availableSlots`, `applyKAnon`,
  `roomUtilisation`, `coverageNote`, the consent state machine, the WCAG contrast helper, `stepProgress`).
- **GitHub Actions CI:** typecheck → lint → test → build.
- **Determinism:** one injectable clock (`lib/clock.ts`); all 28 "now" call sites migrated; deterministic mock ids.
- `db/` scaffold (drizzle config + client + schema), `docs/SECURITY.md`, all guards present.

## Verification
- `npm run typecheck` clean · `npm run lint` clean · `npm run build` green across all routes.
- `npm test`  **38 unit + contract tests green**.
- Every surface, every role, clicks through end-to-end on a phone in light/dark  zero dead ends.

## Outstanding (small; tracked, none change the UI)
- Playwright E2E + axe sweep (closeout §7).
- Optional loading/error mock flag (closeout §3)  states already drawn (Phase 8).

**Part A is the test-guarded baseline. Phase 9 opens  wire it real behind the same UI.**
