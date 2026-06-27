# Phase 6  Super-admin console ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 5.5*

> Goal: the platform operator's console  orgs, plans, the AI rail, integrations, audit. 2FA eyebrow on
> every page (enforced in Phase 9). Every cross-org access and impersonation is audited.

## What shipped

The platform console (`navKey: admin`) behind `requireSuperAdmin` (demo operator Sizwe Ndlovu), with a
**2FA eyebrow** on every page. Seven surfaces:

### Task 6.1  Orgs, plans & platform billing
- **`/admin`**  platform `StatCard`s: organisations (active/trial/suspended), **MRR**, team members,
  sessions (7d), AI spend, integration health; plus an "orgs needing attention" list and a recent-audit
  preview.
- **`/admin/orgs`**  every org on Phila (5 across provinces/plans/states) in a sortable `DataTable`:
  plan, billing status (active / trial / past-due / suspended), members, 7-day sessions, AI spend, with
  **suspend / restore** and **impersonate (audited)** actions and a create-org action.
- **`/admin/plans`**  **pricing & entitlements management**: editable plan tiers (Community / Practice /
  Programme / Enterprise) with **inline editing of price + per-feature entitlements** (seats, AI tokens,
  video minutes, messaging, rooms), subscriber + MRR-contribution counts, popular/NGO badges, and the
  platform MRR summary. Entitlements come from the plans table  **no drift**. (Platform subscription
  billing  orgs pay Phila  is distinct from an org's BYO gateway in Phase 5.)

### Task 6.2  AI rail, integrations catalogue & audit
- **`/admin/ai`**  the **platform-only AI rail**: provider (Anthropic / OpenAI / Bedrock), the single
  platform key (every org uses it, no BYO), model + max-tokens, **off / mock / live** status, the
  **POPIA s.72 cross-border acknowledgement that gates "live"** (live is disabled until acknowledged 
  verified), monthly spend + a default per-org spend cap, and Test connection.
- **`/admin/integrations`**  the provider catalogue grouped by category (messaging · video · payment
  providers · platform), each with **off / mock / live** + Test, curating what orgs can connect.
- **`/admin/audit`**  the platform-wide PII-access + admin-action ledger in a searchable `DataTable`
  with a **real CSV export** (and the export is itself audited)  "the ledger you can show the
  Information Regulator".
- **`/admin/settings`**  platform **feature flags** (self-serve sign-ups, public pages, funder portal,
  industry-in-a-box onboarding, and a cautioned maintenance mode).

## New building blocks
- `requireSuperAdmin` guard + the demo operator principal; `navKey: admin` + the admin nav; the 2FA eyebrow.
- `components/admin/*`  `OrgsTable`, `PlansManager` (editable pricing/entitlements), `AiRail`,
  `IntegrationsCatalogue`, `AuditTable` (CSV download), `FeatureFlags`.
- Platform types + fixtures (4 plans, 5 orgs + subscriptions, AI rail config, integrations catalogue,
  audit ledger) + 6 seam methods (`getPlatformOverview`, `listPlatformOrgs`, `listPlans`, `getAiRail`,
  `listIntegrations`, `listPlatformAudit`) + db stubs.
- `Label` now takes an explicit `optional` prop (no more auto-"optional" on every field).

## Verification
- `build` / `typecheck` / `lint` clean. 7 new `/admin/*` routes (all dynamic). Total **37 routes**.
- Runtime: every page renders; orgs show all billing states; plans show all tiers + MRR; the **AI s.72
  gate disables "live" until acknowledged**; integrations + audit (with CSV) + settings render. No
  regression on `/`, `/app`, `/me`, `/hub`, `/funder`, `/o/[slug]`.

## Milestone  Part A roles complete
**All five roles + the public/booking surfaces are now built and demoable on mock data**: public →
booking → client (`/me`) → counsellor (`/app`) → org-admin Hub (`/hub`) → funder (`/funder`) →
super-admin (`/admin`). What remains in Part A is **polish**: Phase 7 (signature cross-role surfaces) and
Phase 8 (states + 360px responsive + motion + WCAG 2.2 AA  the demo-ready ship gate).

## Next  Phase 7
Signature surfaces: the resource calendar, the create-appointment modal, the video-room shell + AI-draft
pipeline, the A4 document builder, and outcome measures.
