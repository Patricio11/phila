# Phase 16  Analytics & Funder / M&E Reporting + Funder Portal ✅

*Shipped: 2026-06-30 · Part B · the reporting differentiator made **real** (DB-backed) + richer*

> The analytics surfaces were mock-only. Phase 16 makes them **real**, computed from the
> actual clinical tables, with k-anonymity intact  and adds the insights they were missing.

---

## Real, not mock
A pure computation layer (`lib/domain/reporting.ts`) is fed **DB rows** by `db/queries/analytics.ts`
(reporting + insights) and `db/queries/grants.ts` (grant + funder views). `db-provider` overrides
**`getReporting`, `getHubInsights`, `getGrantView`, `getFunderGrantView`, `listGrants`**  no mock
fallback. Outcome measures use the real `taken_at`, bucketed into weeks-ago relative to `now`.

## Honest aggregation
- **k-anonymity floor (5)** + small-cell suppression on every funder-facing breakdown; suppressed
  cells are *labelled* ("too few to report"), never silently dropped. Coverage stated on every figure.
- The Hub's own operational **Insights** keep honest counts (internal view); funder **Reporting** + grant
  dashboards are k-anon'd.
- A **realistic cohort is seeded** (39 consented clients, varied demographics + improving PHQ-9 series +
  grant allocations) so the dashboards are meaningful *and* suppression is demonstrable (e.g. non-binary
  n=3 and Free State n=1 suppress; women n=22 and Gauteng n=20 show).

## Richer insights (the "more useful" pass)
- **Insights:** period-over-period **trend chips**  completed, attendance (±pts), new clients, revenue 
  computed against the previous comparable window.
- **Reporting:** an **improvement-rate** stat (% whose first→latest PHQ-9 dropped ≥5) + a **provinces-reached**
  stat + a server-computed **key-findings** headline above the editable narrative.
- **Grant dashboard:** an **at-a-glance** status line ("N of M indicators on track at X% of the period; behind: …").

## Grant-indicator engine (DB)
Each indicator's **actual vs target** from `grant_allocations` + clinical data per its rule
(`unique_clients`, `sessions_delivered`, `pct_female`, `pct_employed`, `pct_youth`, `phq9_improved_5`),
de-duped via distinct allocation, with a **paced "expected"** marker for count indicators and
on-track / at-risk / behind classification.

## Funder portal (wired, real)
- `/funder` + `/funder/grants/[id]` read real data with **provider-enforced scoping**  a funder reaches
  ONLY their grant(s); an out-of-scope id returns null → 404. Every view **k-anon + audited** (`funder.view`).
- **Narrative updates persist** (`grant_narratives`): the org posts from the Hub (ownership-checked) and the
  funder sees it on their portal. Login: `palesa.mokoena@dsd.example.gov.za` / `phila1234`.
- **One-click CSV** funder report (k-anon, `pii.export` audited); PDF via browser print.

## Proof
- Integration tests: reporting breakdowns (k-anon invariant), insights window + previous-period deltas,
  grant view + indicators + headline, funder scope (in-scope ok / out-of-scope null), narrative round-trip.
- Full suite green; prod build clean; tsc + lint clean. Screenshots in `/screenshots`.

## Honest follow-ups
- GAD-7 trend alongside PHQ-9 (schema + compute ready; seed PHQ-9 only for now).
- Scheduled PII-free rollups (currently computed on read  fast at this scale).
- Templated branded PDF (CSV + print cover the need today).
