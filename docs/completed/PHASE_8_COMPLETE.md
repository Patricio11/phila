# Phase 8  States + responsive + motion + a11y (the demo-ready gate) ✅

*Shipped: 2026-06-27 · Part A (mock-first) · The Part-A ship gate*

> Goal: the entire product is a beautiful, clickable, mock-driven demo of all roles  in either theme,
> installable as an app, finished and alive, with zero dead ends.

## What shipped

### Task 8.1  Cross-cutting states
- **`Skeleton` / `PageSkeleton` / `TableSkeleton`** (motion-safe shimmer) + **route `loading.tsx`** for
  every role group (`/app`, `/hub`, `/me`, `/admin`, `/funder`) and the list-heavy routes (clients,
  team, orgs, audit)  real streaming loading states.
- **Error boundaries**  `app/error.tsx` (calm, specific, "Try again", not apologetic) + a self-contained
  `app/global-error.tsx`.
- **`BlockedState`**  names *why* something is hidden (consent missing / feature dormant / over the
  cost cap) and the next step. Applied to the dossier's consent-gated demographics ("Demographics not
  shared").
- **Empty states** (instructional, throughout) and the **offline** shell + send-queue stub were already
  in place from earlier phases.

### Task 8.2  Responsive (360px-first)
- Every surface is built 360-first: the sidebar collapses to a drawer, the calendar becomes an agenda,
  dialogs become bottom-sheets, the A4 invoice table scrolls within the sheet, the dashboard/hub grids
  stack. Verified across roles.

### Task 8.3  Motion + accessibility
- The single page-load `rise` reveal + the marketing scroll-reveal, all GPU-only and **fully
  `prefers-reduced-motion` aware** (movement stripped, final state shown).
- **WCAG 2.2 AA**: a **skip-to-content** link + focusable `#main-content`, the visible accent focus ring
  on all interactives, labelled controls (aria-labels on icon buttons, switches as `role="switch"`),
  toasts as `aria-live` status regions, and AA contrast held in both themes.

### Task 8.4  Theme + PWA
- **Light + dark** verified on every surface; the toggle persists; **no flash-of-wrong-theme** (set
  before paint). AA contrast holds in both.
- **PWA**: `manifest.webmanifest` + the aloe icon + the service worker (offline shell, SWR assets) served
  and installable; the offline send-queue stub behaves.

## Verification
- `build` / `typecheck` / `lint` clean  **38 routes**.
- Runtime: the blocked state, skip link + `#main-content`, offline page, manifest + service worker, and
  theme tokens all confirmed; **18 routes across all five roles + public/booking return 200**.

## 🟦 PART A SHIP GATE  MET
A stranger can demo the **whole product across all roles on a phone, in either theme, installed as an
app**  it looks finished and alive, with zero dead ends. Public marketing → org page → booking → client
portal → counsellor workspace → org-admin Hub → funder portal → super-admin console, all on the
`dataProvider` seam.

## Next  Part B
Phase 9 (Better Auth + consent persistence) begins wiring mock → real **behind the seam**, with no UI
change: `DATA_PROVIDER=db`, the RLS data engine, scheduling, notifications, video, the AI scribe,
payments, funder analytics, SEO, hardening, tests, launch.


Demo logins (all password phila1234): nomsa@masizakhe.org.za (counsellor), thandeka@masizakhe.org.za (hub), lerato.m@example.co.za (client), palesa.mokoena@dsd.example.gov.za (funder), ops@philasa.com (super admin).