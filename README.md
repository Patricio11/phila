# Phila

A calm, POPIA-grade operations platform for **South African counselling organisations** —
the daily clinical loop, programme-grade oversight, and funder/demographic reporting that falls
out of the clinical work. The brand is **Phila** (isiZulu / isiXhosa, *to heal, to be well*);
`philasa.com` is the web address.

> Read alongside the specs in the parent folder: `TO_START_EVERY_SESSION.md` (rules + stack),
> `ROADMAP.md` (the phased build), `DESIGN.md` (design + experience), and `docs/SECURITY.md`
> (the three-layer auth + RLS model).

## Status

**Part A is mock-first.** Every surface is built and demoable on the `dataProvider` seam before any
database exists; Part B (Phase 9+) swaps `DATA_PROVIDER=mock → db` behind the seam **with no UI
change**. See `ROADMAP.md`.

- ✅ **Phase 0 — Foundations & POPIA spine.** Design tokens (light/dark), Inter, the collapsible app
  shell, the consent / audit / encryption spine, the `dataProvider` seam + mock fixtures, the PWA
  shell, and the counsellor dashboard reference build.
- ✅ **Phase 1 — Landing + org public page (SEO).** The product-led landing at `/` (the real
  dashboard in the hero, smooth scroll-reveal motion), and each org's SSG public micro-site at
  `/o/[slug]` with `MedicalBusiness` JSON-LD, honest credential chips, and a contrast-safe brand accent.
- ✅ **Phase 2 — Booking & intake flow.** A resumable, 360-first stepped wizard at `/o/[slug]/book`
  (service+counsellor → time → intake → consent → confirm) running the real availability engine via
  Server Actions, with affirmative (never pre-ticked) consent enforced server-side.
- ✅ **Phase 3 — Client portal (`/me`).** The lightest shell: upcoming session (with a Join window),
  session history, documents, billing, the consent centre (revoke/grant per purpose), and "From your
  counsellor" — the consent-gated shared care plan with tickable tasks (never the private note).
- ✅ **Phase 4 — Counsellor workspace.** The daily loop: calendar (week + agenda, drag-to-reschedule),
  caseload `DataTable`, the client dossier (consent-gated demographics, outcome trend), the session +
  note editor (private note + mock AIDraft → sign, mark progress, care-plan composer), and supervision.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000  → redirects to /app (counsellor workspace)
```

The app boots on **mock data** — no database or secrets required in Part A.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server (Turbopack). |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`). |
| `npm run lint` | ESLint. |
| `npm run format` | Prettier. |
| `npm run db:*` | Drizzle Kit (`generate` / `migrate` / `push` / `studio`) — **Part B / Phase 10**. |

## Environment

Part A needs **nothing**. The variables below light up in Part B — see `.env.example`.

| Var | Phase | Purpose |
|-----|-------|---------|
| `DATA_PROVIDER` | 0 | `mock` (default) or `db`. |
| `DATABASE_URL` | 10 | Neon Postgres (EU now → SA region before launch). |
| `PHILA_FIELD_KEY` | 10 | base64 32-byte key for field-level encryption (required in prod). |

## Architecture (Part A)

```
app/                 route segments: /(landing) · /app (counsellor) · /offline · (hub|me|admin|funder later)
components/          ui/ primitives · shell/ (sidebar, top bar) · schedule/ · charts/ · dashboard/ · theme/ · brand/
lib/
  domain/enums.ts    the value sets (mirrors Part-B Postgres enums) — SA reference data baked in
  auth/              roles + capabilities (redaction matrix), session, guard scaffold
  consent/           versioned, purpose-bound consent state machine
  audit/             logAccess() — every PII read/export recorded
  crypto/            AES-256-GCM field encryption
  retention/         soft-delete + erasure-job stub
  mock/              the dataProvider mock impl + typed fixtures + helpers
  data-provider.ts   the seam (mock | db)
db/                  drizzle client (no live connection) + the POPIA/tenancy spine schema
public/              PWA manifest, service worker, app icon
docs/                SECURITY.md + completed/PHASE_N_COMPLETE.md
```

The real isolation boundary in Part B is **Postgres Row-Level Security**, not app checks
(`docs/SECURITY.md`). The route guard is UX; the DAL and RLS are safety.
