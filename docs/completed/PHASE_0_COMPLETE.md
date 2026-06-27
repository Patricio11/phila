# Phase 0  Foundations & POPIA Spine ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Stack: Next.js 16 · React 19 · Tailwind v4 · TypeScript strict*

> Goal: a correct skeleton with the compliance + tenancy seams present **before any real PII
> exists**. Built on the `dataProvider` seam so Part B is a swap, not a rewrite.

## What shipped

### Task 0.1  Project skeleton
- Next.js 16 (App Router, **no `src`**, RSC + Server Actions, Turbopack), TypeScript **strict +
  `noUncheckedIndexedAccess`**, ESLint, Prettier.
- Tailwind v4 with design tokens in `app/globals.css` via `@theme`  the neutral + green-accent
  palette, light/dark, the 8px / radius / shadow scale, motion + reduced-motion utilities (DESIGN §2–4).
- Folder layout by route segment + `components/`, `db/`, `lib/` (incl. `lib/mock/`), `docs/`.
- Drizzle client + `drizzle.config.ts` scaffolded  **no live connection** in Part A.
- **English only**  no i18n framework, no locale routing, no catalogs.

### Task 0.2  POPIA + tenancy infrastructure (built now, even for mock)
- `lib/consent`  versioned, purpose-bound consent **state machine** (`none → granted(v) → revoked`)
  with `assertConsent()` at read boundaries.
- `lib/audit`  `logAccess()` invoked on every (mock) PII read (the dashboard load records an
  audited `pii.read`). In-memory/console sink now; persistent table in Phase 10.
- `lib/crypto`  AES-256-GCM field encryption; key from `PHILA_FIELD_KEY`; fatal-if-missing in prod.
- `lib/retention`  soft-delete (`deletedAt`) convention + erasure-job stub.
- `lib/auth`  RBAC **capability matrix** (the redaction matrix as code, incl. audited Hub note
  access), the `Principal`/session abstraction (mock now, Better Auth in Phase 9), and the guard
  scaffold (`requireAuth` / `requireOrg` / `requireCapability` / `requireOrgFeature` /
  `requireFunderGrant`). RLS model documented in `docs/SECURITY.md`.

### Task 0.3  Design system + the `dataProvider` seam
- Inter (self-hosted via `next/font`, tabular numerals on data); the full token system.
- **Theme system:** light + dark from one CSS-variable set; a persisted toggle set **before paint**
  (no flash-of-wrong-theme). *Light + dark only, light default*  locked to DESIGN §10. (The
  ROADMAP appendix's `system` option is intentionally deferred; trivial to add later.)
- **PWA shell:** `manifest.webmanifest` + aloe app icon + a service worker (offline shell, SWR for
  assets) + `RegisterSW`; the offline send-queue **interface** is stubbed for the Phase-8 queued-state UI.
- The **`dataProvider`** interface + `mockProvider` + typed fixtures + helpers
  (`availableSlots`, `roomUtilisation`, `applyKAnon`, `coverageNote`) that mirror Part-B logic.
  `DATA_PROVIDER=mock|db` flag.
- The **app shell** (DESIGN §5): the smooth collapsible sidebar (248↔72), the sticky translucent
  top bar, the content `rise` reveal.
- The **counsellor dashboard** (`/app`) as the living reference build  stat cards with honest
  coverage, today's schedule with the "now" line, the outcomes sparkline, and the needs-attention
  triage panel  all reading from `mockProvider` with believable South African data.

## Verification
- `npm run build`  clean across all routes (`/`, `/app` dynamic, `/offline`, `/_not-found`).
- `npm run typecheck`  clean (strict + `noUncheckedIndexedAccess`).
- `npm run lint`  clean.
- Runtime: `/` → 307 → `/app`; the dashboard renders the live caseload for Nomsa Dlamini at
  Masizakhe Counselling, with the safeguarding flag, no-show rate, and outcome trend.

## Notes / decisions
- **Theme:** light + dark only (DESIGN §10 wins over the ROADMAP `system|light|dark` enum). Flagged.
- **Route segments:** role workspaces use real segments (`/app`, later `/hub` `/me` `/admin`
  `/funder`), not parenthesised route groups (which resolve to `/` and would collide with the landing).
- **Mock data is authentic SA**, not filler: real-shaped isiZulu / isiXhosa / Afrikaans / English /
  Gujarati names, ZAR pricing, +27 numbers, HPCSA / ASCHP / SACSSP registration, Gauteng sites,
  the SADAG crisis line in safeguarding copy.

## Next  Phase 1
Phila landing (`/`) + the org public page (`/o/[slug]`) with SEO scaffolding. See
`docs/PHASE_1_PLAN.md`.
