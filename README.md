# Phila

A calm, POPIA-grade operations platform for **South African counselling organisations** 
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

- ✅ **Phase 0  Foundations & POPIA spine.** Design tokens (light/dark), Inter, the collapsible app
  shell, the consent / audit / encryption spine, the `dataProvider` seam + mock fixtures, the PWA
  shell, and the counsellor dashboard reference build.
- ✅ **Phase 1  Landing + org public page (SEO).** The product-led landing at `/` (the real
  dashboard in the hero, smooth scroll-reveal motion), and each org's SSG public micro-site at
  `/o/[slug]` with `MedicalBusiness` JSON-LD, honest credential chips, and a contrast-safe brand accent.
- ✅ **Phase 2  Booking & intake flow.** A resumable, 360-first stepped wizard at `/o/[slug]/book`
  (service+counsellor → time → intake → consent → confirm) running the real availability engine via
  Server Actions, with affirmative (never pre-ticked) consent enforced server-side.
- ✅ **Phase 3  Client portal (`/me`).** The lightest shell: upcoming session (with a Join window),
  session history, documents, billing, the consent centre (revoke/grant per purpose), and "From your
  counsellor"  the consent-gated shared care plan with tickable tasks (never the private note).
- ✅ **Phase 4  Counsellor workspace.** The daily loop: calendar (week + agenda, drag-to-reschedule),
  caseload `DataTable`, the client dossier (consent-gated demographics, outcome trend), the session +
  note editor (private note + mock AIDraft → sign, mark progress, care-plan composer), and supervision.
- ✅ **Phase 5  Org-admin Hub.** Nine surfaces: overview (income prediction), all-counsellor calendars,
  team & roles (honest reach), rooms (weekly occupancy rhythm + insights), clients, intake, invoicing,
  the consent-gated **k-anon reporting** + one-click funder report, and settings (dormant integrations +
  BYO payment connection + public-page editor).
- ✅ **Phase 5.5  Funder & grant module + funder portal.** The grant-indicator engine (actuals
  auto-computed from the clinical work, paced vs the period, on-track/at-risk/behind), narrative updates,
  and a scoped, k-anon, read-only **funder portal** (`/funder`)  a funder reaches only their own grant.
- ✅ **Phase 6  Super-admin console (`/admin`).** Orgs (suspend/impersonate-audited), **editable pricing
  plans + entitlements + MRR**, the platform AI rail (with the POPIA s.72 gate on "live"), the
  integrations catalogue, and the platform audit ledger with CSV export. **All five roles complete.**
- ✅ **Phase 7  Signature surfaces.** The reusable create-appointment modal, the video-room shell
  (+ paste-link fallback) with AI structured-extraction, the A4 invoice builder (live VAT + print), and
  PHQ-9/GAD-7 outcome capture.
- ✅ **Phase 8  Demo-ready gate.** Skeletons + loading/error/blocked states, skip-link + a11y sweep,
  reduced-motion, light/dark, and PWA install + offline shell. **Part A ships: all roles, on a phone,
  in either theme, installed as an app, zero dead ends.**

**Part B runs on the real database** (`DATA_PROVIDER=db`, Neon Postgres)  same UI, real data,
everything **seeded** (no mock at runtime). Per-phase records live in `docs/completed/`; verify with
`docs/SMOKE_TEST.md`.

- ✅ **Phase 9  Identity & auth.** Better Auth (credentials), role-routed sign-in, seeded demo accounts
  (`docs/DEMO_LOGINS.md`, password `phila1234`).
- ✅ **Phase 10  Data engine.** Drizzle schema + migrations, **Postgres RLS** (non-owner `phila_app`
  role, leak-proof tests), field-level AES-256-GCM encryption, the full seed (`npm run db:seed`).
- ✅ **Phase 11  Scheduling engine.** Real availability + GiST no-double-booking constraints
  (counsellor + room, race-free), recurring series (edit this / all following), working-hours guards.
- ✅ **Phase 12  Notifications rail.** The `deliver()` chokepoint: templates, routing, quiet hours,
  opt-outs (POPIA), per-org **credit metering** (ledgered)  WhatsApp BYO, SMS/email platform-provided.
- ✅ **Phase 13  Video (LiveKit).** Self-host or Cloud, admin-managed under **/admin/integrations**
  (Demo/Live toggle + Test connection  no env keys); signed join links, branded waiting room.
- ✅ **Phase 14  AI scribe.** OpenAI or Claude behind the admin **AI rail**; de-identification before any
  cross-border call, org consent gate (POPIA s.72), draft note + funder fields + care-plan draft, metered.
- ✅ **Phase 15  Payments (Paystack).** Three real money flows: org credit packs + plan subscriptions
  (platform gateway) and client invoice payments via the **org's own gateway** (signed `/pay/[token]`
  page)  all idempotent, webhook + callback settled.
- ✅ **Phase 16  Analytics & funder/M&E reporting.** DB-computed insights (period deltas), k-anon
  demographic reporting + improvement rate, the grant-indicator engine (actual vs paced target), and the
  live scoped funder portal with persisted narratives.
- ✅ **Phase 17  Org public page + SEO.** `org_public_pages` section editor (show/hide per section),
  world-class `/o/[slug]` micro-site, JSON-LD + sitemap + robots, PII-free page→booking funnel.
- ✅ **Phase 17.2  Scheduling & notifications polish.** Online sessions surface their **join link**
  (Join now / Copy) on the appointment detail; **real in-app notifications** (bell + `notifications`
  table) with **email + in-app as the defaults** (SMS opt-in) firing on Hub *and* public bookings;
  searchable Client/Counsellor pickers (`SearchSelect`) with **inline "New client"** (primary counsellor
  = the selected counsellor); seeded starter credits (500 SMS / 1000 email) + super-admin top-ups at
  `/admin/orgs/[id]`.
- ✅ **Phases 18 / 18.5 / 18.6 / 18.7**  documents (Supabase storage), real-time team messaging,
  the org forms library, and client onboarding (see `docs/ROADMAP.md`).
- ✅ **Production readiness (W1–W4).** Team management (invite → activate, roles & honest reach),
  **mandatory email verification** + a branded onboarding/admin-approval lifecycle on a **17-day
  no-card trial**, security hardening (HSTS/CSP + security headers, webhook HMAC, timing-safe token
  checks, fail-strict clinical audit), platform **feature governance** (kill-switch → per-org override →
  plan → self-toggle) with a DB-backed, **super-admin-editable plan catalogue**, and a fully-seeded
  two-tenant demo with RLS isolation proven end-to-end. See `docs/PRODUCTION_READINESS_PLAN.md`.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000  → redirects to /app (counsellor workspace)
```

With no env the app boots on **mock data** (Part A). For the real thing (Part B): set
`DATA_PROVIDER=db` + the vars below in `.env.local`, run `npm run db:seed` (idempotent  seeds
orgs, accounts, clients, the M&E cohort, credits, the public page, and the LiveKit demo
integration), then sign in with an account from `docs/DEMO_LOGINS.md`. External gateways
(Paystack, Resend email, LiveKit, AI providers) are configured **in-app** by the super-admin
under `/admin/integrations`  encrypted at rest, with Test-connection buttons; never env vars.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server (Turbopack). |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`). |
| `npm run lint` | ESLint. |
| `npm run format` | Prettier. |
| `npm run db:*` | Drizzle Kit (`generate` / `migrate` / `push` / `studio`)  **Part B / Phase 10**. |

## Environment

Part A needs **nothing**. Part B needs only the core vars below (see `.env.example` for the full
annotated list)  every gateway/provider key (Paystack, Resend, LiveKit, OpenAI/Claude) is managed
in-app under `/admin/integrations`, not in env.

| Var | Phase | Purpose |
|-----|-------|---------|
| `DATA_PROVIDER` | 0 | `mock` (default) or `db`. |
| `DATABASE_URL` | 10 | Neon Postgres (EU now → SA region before launch). |
| `PHILA_FIELD_KEY` | 10 | base64 32-byte key for field-level encryption (required in prod; also encrypts the admin-managed integration credentials). |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | 9 | Auth signing secret + the app's base URL (also signs video join links + invoice pay-links). |

## Architecture

```
app/                 route segments: /(landing) · /app (counsellor) · /hub · /me · /admin · /funder · /o/[slug] · /offline
components/          ui/ primitives · shell/ (sidebar, top bar) · schedule/ · charts/ · dashboard/ · theme/ · brand/
lib/
  domain/enums.ts    the value sets (mirrors Part-B Postgres enums)  SA reference data baked in
  auth/              roles + capabilities (redaction matrix), session, guard scaffold
  consent/           versioned, purpose-bound consent state machine
  audit/             logAccess()  every PII read/export recorded
  crypto/            AES-256-GCM field encryption
  retention/         soft-delete + erasure-job stub
  mock/              the dataProvider mock impl + typed fixtures + helpers
  data-provider.ts   the seam (mock | db); db-provider.ts is the real impl
  db/scoped.ts       the RLS-scoped request path (runs as the phila_app role, per-op org GUC)
db/                  drizzle client + schema + queries/ (the DAL) + rls.sql + seed-all.ts
public/              PWA manifest, service worker, app icon
docs/                SECURITY.md · PRODUCTION_READINESS_PLAN.md · ROADMAP.md · completed/PHASE_N_COMPLETE.md
```

The real isolation boundary in Part B is **Postgres Row-Level Security**, not app checks
(`docs/SECURITY.md`). The route guard is UX; the DAL and RLS are safety.
