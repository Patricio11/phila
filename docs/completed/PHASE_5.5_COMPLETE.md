# Phase 5.5  The Funder & Grant module + Funder portal ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 5*

> Goal: turn "the report writes itself" into a real surface  grants with targets, clinical work that
> auto-rolls up to them, and a scoped, k-anon, read-only **funder portal**. The growth-loop
> differentiator no incumbent in the niche has. Every funder-facing figure is aggregate, k-anonymised,
> consent-gated, and audited  a funder never sees an identifiable client (Rules #1, #10).

## What shipped

### Task 5.5.1  Funders & grants (Hub)
- **`/hub/funders`**  funders + grants as `GrantCard`s (funder type, period, amount, restricted,
  reporting schedule, indicator + tagged-client counts), with an **invite-funder** action.

### Task 5.5.2  Indicators & targets (the logframe)
- Each grant carries **indicators with a `metric` computation key** (`count` / `percentage` /
  `outcome_delta` / `demographic_proportion`)  the actual is **derived from the clinical work, never
  typed**.

### Task 5.5.3  Allocate clinical work to grants
- `grant_allocations` tag clients to grants (a client can map to several; counts de-duplicate).

### Task 5.5.4  Live dashboard + narrative + report builder
- **`/hub/grants/[id]`**  the **grant-indicator engine** live: each indicator as an **`IndicatorMeter`**
  (actual vs target, **on-track / at-risk / behind**). Count indicators are **paced against the period**
  (a marker shows what's expected by now); ratios compare directly. k-anon demographic breakdowns
  (by gender / age band / province  small cells suppressed), the aggregate PHQ-9 outcome trend, a
  period-elapsed + allocation strip, the **`NarrativeComposer`** (post updates the funder sees), and a
  **one-click period export** (PDF/CSV)  audited.

### Task 5.5.5  The Funder portal (`/funder`, role `funder`)
- A pared, read-only shell with an always-on **"aggregate, anonymised"** banner. `/funder` lists the
  funder's scoped grants; `/funder/grants/[id]` shows the same live dashboard, **read-only**  indicators
  vs target, k-anon breakdowns, outcome trend, the org's narrative updates. **Every view audited.**

### Task 5.5.6  Invite a funder (mock)
- Mock invite action; the scope lives in `funder_contacts` (user ↔ funder ↔ grant-ids).

## The honest constraints (verified)
- **Scoping enforced at the seam:** `getFunderGrantView` returns `null` for any grant the funder isn't
  scoped to  verified live: **`/funder/grants/g_lotto` 404s** for the DSD funder (scoped only to
  `g_dsd`). A funder can never reach another grant.
- **k-anon everywhere:** breakdown cells below the floor read **"too few to report"** (a tiny programme
  legitimately shows this).
- **Aggregate + consent-gated:** only clients with the `demographics` consent count toward funder figures;
  the engine skips the rest.
- **Honest classification:** the demo shows a real mix  On track (female %), At risk (paced client count),
  Behind (PHQ-9 improvement, sessions vs an ambitious target)  not vanity green.

## New building blocks
- `components/funder/*`  `IndicatorMeter`, `GrantCard`, `BreakdownBars`, `GrantDashboard` (shared by Hub
  + portal via a `narrativeSlot`), `NarrativeComposer`, `funder-actions` (invite + export).
- The **grant-indicator engine** in the provider (paced + k-anon) + 5 seam methods (`listFunders`,
  `listGrants`, `getGrantView`, `listFunderGrants`, `getFunderGrantView`) + db stubs.
- `requireFunder` guard + the demo funder principal (Palesa Mokoena, DSD); `navKey: funder`.
- Fixtures: funders, grants, indicators (with computation rules), allocations, narratives, funder contact.
- Hub nav split into "Reporting" + "Funders & grants"; `Tag` reused.

## Verification
- `build` / `typecheck` / `lint` clean. New routes: `/hub/funders`, `/hub/grants/[id]`, `/funder`,
  `/funder/grants/[id]` (all dynamic). Total **30 routes**.
- Runtime: grant dashboard renders the indicator mix + pacing + composer + export; funder portal renders
  the banner + read-only dashboard + "too few to report"; **funder scoping 404 confirmed**. No regression
  on `/`, `/app`, `/me`, `/hub`, `/o/[slug]`.

## Milestone
**All five Part-A roles are now demoable on mock data**  client, counsellor, org-admin Hub, **funder**,
plus the public/booking surfaces. Only the platform **super-admin console (Phase 6)** remains in Part A.

## Next  Phase 6
The super-admin console (`/admin`): orgs, plans & platform billing, the AI rail, the integrations
catalogue, and platform-wide audit (2FA eyebrow).
