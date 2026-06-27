# Phase 1 — Phila landing + org public page (SEO) · PLAN

*Opens after Phase 0. Mock data, production-grade UI. Screen detail: `DESIGN.md` §9.*

## Recheck before starting
- Phase 0 shipped: tokens, app shell, `dataProvider` seam, mock fixtures, counsellor dashboard.
- The landing/public pages are **marketing/public** surfaces → `robots: index` (the app is
  `noindex`); they are SSR/ISR, not behind the app shell.
- Provider needs a public read path: `getOrgBySlug` exists; add public-page content + team + services
  to the mock for `/o/[slug]`.

## Task 1.1 — Phila landing (`/`)
- Replace the current `/ → /app` redirect with the real landing (move the redirect convenience to a
  "Open the app" CTA / sign-in once auth lands).
- Product-led, in the tool's own visual language: hero showing the **real dashboard** in a clean
  browser frame beside a sharp headline + one CTA ("Book a walkthrough"); the daily-loop demo; three
  pillars (asymmetric, each shown in product); the funder story; a specific POPIA / data-in-SA trust
  band; who-it's-for; one real voice; calm close. No stat-hero, no competitor names, no medical-aid claims.

## Task 1.2 — Org public page (`/o/[orgSlug]`)
- `<OrgPublicShell>`: hero (logo, `--brand-accent`, intro), About, **Services** (duration +
  price/enquire), **Team** (`<CredentialChip>`), location/online, prominent **Book** CTA.
- SEO: per-org `generateMetadata` (title/meta/OG), JSON-LD (`MedicalBusiness`, honest non-diagnostic
  copy), SSR.
- Contrast-safe `--brand-accent` via `lib/contrast.ts` (auto-darken on AA fail) — **new in this phase**.

## New building blocks this phase
- `lib/contrast.ts` (relative luminance + AA check + auto-darken).
- `components/marketing/*` (landing sections) + `components/public/*` (`OrgPublicShell`,
  `CredentialChip`, service/team cards).
- Mock additions: `org_public_pages` content shape + per-org services/team already in fixtures.

## Done when (mock)
Any mock org renders a branded, SEO-tagged public page that links into booking; the landing sets the
quality bar and is fully responsive at 360px.
