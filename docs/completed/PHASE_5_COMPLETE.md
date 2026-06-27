# Phase 5 — Org-admin Hub ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 4*

> Goal: programme-grade oversight + the funder/demographic reporting differentiator, on mock data.
> The Hub is the *ceiling* for the org's data — but clinical notes stay author/supervisor-only; any Hub
> note access is audited (Care-Confidentiality Rule).

## What shipped

The Hub shell (`navKey: hub`) behind a `requireHub` guard with the demo org-admin (Thandeka Mbeki).
Nine surfaces:

### Task 5.1 — Overview + calendars
- **`/hub`** — org-wide `StatCard`s with honest coverage: clients today/week/month, income + **income
  prediction** (from scheduled future sessions), no-show rate, open intakes, pending credential checks,
  outcomes captured; plus the needs-attention triage (safeguarding + credentials).
- **`/hub/calendars`** — every counsellor's week merged into one oversight view (reuses `CalendarWeek`
  with **drag-to-reschedule**); events do **not** open clinical notes here (counsellor-only).

### Task 5.2 — Team, roles & clients
- **`/hub/team`** — a `DataTable` of every member with **`TeamRoleChip` + honest reach** ("Front desk ·
  no notes", "Finance · no clinical", "Programme manager · aggregate only"), credential chips, active
  state, invite/manage actions. All five org roles present.
- **`/hub/clients`** — the org-wide client table with **reassign** and **cancel-with-stats-preserved**
  (Outcome-Honesty: removing a client never distorts compiled reporting). No clinical-note navigation.

### Task 5.6 — Rooms & resources (made genuinely useful)
- **`/hub/rooms`** — a site-grouped, multi-site resource manager: a **summary band** (rooms · sites ·
  avg utilisation · in maintenance), and per room a **weekly occupancy rhythm** (per-day utilisation
  bars, today highlighted), an honest **insight badge** (Near capacity / Healthy use / Room to spare /
  Idle), equipment tags, **counsellor → room day/time assignments**, and the next bookings.

### Task 5.3 — Intake + invoicing
- **`/hub/intake`** — track each client's intake (completed / sent / not sent); send to a client or a
  programme cohort.
- **`/hub/invoicing`** — an invoice board (outstanding + paid totals) with a searchable, sortable
  `DataTable` (paid / unpaid / cancelled / refunded) and a Create action (the A4 builder lands in 7.4).

### Task 5.4 — Reporting (the differentiator)
- **`/hub/reporting`** — **consent-gated** demographic filtering (province / gender / age band /
  employment via a custom `FilterMenu`, no native select), breakdowns by province / gender / population
  group / age band / employment with a **k-anonymity floor + small-cell suppression** ("too few to
  report"), an aggregate PHQ-9 outcome trend, an honest coverage caption everywhere, and a **one-click
  funder report** (PDF/CSV) — every demographic read/export audited.

### Task 5.5 — Settings, payments & public page
- **`/hub/settings`** — scheduling defaults + business hours; **integration toggles dormant by default**
  (AI toggle noted as the POPIA cross-border consent gate); the **`PaymentConnectionCard`** (BYO
  gateway: pick Stitch / Ozow / Yoco / Paystack → enter credentials → Test → connect & set default —
  clients pay the org directly); and a **public-page editor** (intro, contrast-safe brand accent, SEO).

## New building blocks
- `components/ui/data-table.tsx` (reused heavily), `components/ui/filter-menu.tsx` (custom select).
- `components/hub/*` — `TeamRoleChip`, `TeamTable`, `HubClientsTable`, `IntakeTracker`, `InvoiceBoard`,
  `ReportingView`, `IntegrationToggles`, `PaymentConnectionCard`, `PublicPageEditor`.
- `requireHub` guard + the demo org-admin principal; `navKey: hub`.
- Seam grew 8 hub methods (`getHubOverview`, `listOrgClients`, `listTeam`, `getRoomsOverview`,
  `listIntakeStatus`, `listOrgInvoices`, `getReporting`, `getOrgSettings`) + db stubs; fixtures for the
  full team, room assignments, and more invoices. Reporting server actions (`runReport`,
  `exportFunderReport`) — Zod + audited; the k-anon floor lives in the provider (the seam is the gate).

## Verification
- `build` / `typecheck` / `lint` clean. 9 new `/hub/*` routes (all dynamic). Total 26 routes.
- Runtime: all hub pages render; team shows all five roles + reach; reporting shows consent coverage,
  **"too few to report"** suppression, the population-group breakdown, and the funder export; rooms
  shows the weekly rhythm + insights. No regression on `/`, `/app`, `/me`, `/o/[slug]`.

## Notes / deferred to signature phases (per the roadmap)
- The **A4 invoice/report builder** is Phase 7.4; here invoicing uses a board + create action.
- **Real payment wiring** is Phase 15B; the connection card is the connect/test UX on mock.
- **PHASE 5.5 (the funder & grant module + funder portal)** is the next, separate phase — not included here.

## Next — Phase 5.5
The funder & grant module: funders/grants, indicators & targets (the logframe), allocate clinical work
to grants, the live indicators-vs-targets dashboard + narrative + report builder, and the scoped,
k-anon, read-only **funder portal** (`/funder`).
