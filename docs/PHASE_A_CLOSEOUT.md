# PHASE A — CLOSEOUT (before Part B wiring)

The gate between **Part A (the whole product on mock)** and **Part B (wiring it real)**. Work through it
in order; the goal is that Part B becomes a **swap, not a rewrite**. Nothing here adds features — it
hardens the seam, freezes the contracts, and stands up the test harness so wiring can't silently regress
what already works.

> Read with `TO_START_EVERY_SESSION.md` (rules + stack), `ROADMAP.md` (Phase 8 demo gate → Phase 9
> opens), `DESIGN.md` (the approved system). Brand: **Phila** · domain `philasa.com` · English · SA.
>
> **Highest-leverage items: §1 + §2.** A clean, total seam with a frozen contract is what decides
> whether Part B is a calm swap or a slog. Everything else is hygiene.

---

## 1. Make the seam total
*No screen may reach around `dataProvider`. One leak here is one place Part B becomes a rewrite.*
- [ ] Audit every screen/component: data is read and written **only** through `dataProvider` — no direct
  import of `lib/mock/*` fixtures in components, no inline mock arrays, no screen bypassing the seam.
- [ ] Every method Part B will need **already exists** on the provider, with its **final signature and
  return shape** (the shape the real query/Server Action will return) — wiring fills in bodies, not contracts.
- [ ] Mock types are aligned to the **Phase-10 schema shapes** (entities + enums in `ROADMAP.md` §10.1 /
  Appendix) so they don't drift; redaction/consent-awareness already baked in (private note vs shared
  care plan; demographics only when consented; funder data aggregate + k-anon).

**Done when:** grep finds zero `lib/mock` imports outside `lib/mock/` and the provider; every screen
renders from the provider alone.

## 2. Freeze the contract
*Both providers implement one interface; a single suite proves the swap.*
- [ ] A shared **`DataProvider` TypeScript interface**; `mockProvider` implements it; `dbProvider` (Part B)
  will implement the same. Lock it now.
- [ ] A **provider-conformance test suite** — the same assertions run against whichever provider is
  active. This is the contract that guarantees Part B is a swap.
- [ ] `DATA_PROVIDER=mock|db` switch in place; `dbProvider` exists as a stub that throws "not implemented".

**Done when:** the conformance suite passes against `mockProvider`, and `dbProvider` is a typed stub the
suite can target later.

## 3. Make the mock behave like a backend
*If the mock is synchronous and never fails, Part B's real async will surprise the UI.*
- [ ] All provider methods return **Promises** (real async).
- [ ] The mock can surface **loading / empty / error / blocked** on demand (blocked = consent-missing /
  feature-off / over cost-cap). Every screen already handles all four (Phase 8) — this makes them real,
  not just drawn.

**Done when:** toggling a mock flag drives each screen through loading → data, empty, error, and blocked.

## 4. Determinism
*Scheduling, reminders, and the dashboard "now" line make time-dependent code flaky otherwise.*
- [ ] Injectable `now()` (freeze "today" in tests/demo); fixed UUIDs; one seeded `lib/mock/seed.ts`.
- [ ] No `Math.random()` / `new Date()` reached directly in logic — go through the injectable clock/ids.

**Done when:** two runs with the same seed produce identical screens and the same E2E results.

## 5. Scaffold the Part-B attach points (live stubs)
*So Phase 9–17 clip in cleanly instead of re-plumbing.*
- [ ] **Guards** present and returning a **mock identity** today, ready to back with Better Auth:
  `requireRole` / `requireOrg` / `requireOrgFeature` / `requireFunderGrant` (`lib/auth/guard.ts`).
- [ ] **`logAccess()`** and the **consent utils** are already *called* on the right PII paths (Part B
  just makes them persist) — Rules #1/#3.
- [ ] **Adapters exist as interfaces** with a mock impl + a real **dormant/off** state (Rule #5):
  storage, notifications (WhatsApp/email/SMS), AI, payments (platform billing + org gateway), video.
- [ ] **`db/` scaffolding ready:** drizzle config, `db/client.ts`, empty `schema/`, `migrations/` (+
  `meta/_journal.json`), `rls/` — so Phase 10 starts writing schema, not plumbing.
- [ ] `docs/SECURITY.md` records the three-layer model + the RLS/tenant-isolation intent (enforced Phase 10).

**Done when:** every Part-B phase has a named, typed place to attach with nothing left to wire by hand.

## 6. Meet the demo-ready gate for real (Phase 8)
- [ ] Every surface, every role, clicks through end-to-end — **zero dead ends**.
- [ ] Every empty / loading / error / **blocked** state present.
- [ ] **360px** and **light/dark** on *every* surface (calendar → agenda, video shell, A4 builder, public page).
- [ ] PWA installable + offline-queue **stub** behaves; the one motion moment + **reduced-motion**; WCAG 2.2 AA (axe).
- [ ] `tsc --noEmit` clean; `next build` green across all routes.

**Done when:** a stranger can demo the whole tool across every role on a phone, in either theme, and it looks finished.

## 7. Stand up the harness + the Part-A tests that survive into B
*These freeze the UI and logic contracts so Part B wiring can't regress them.*
- [ ] CI harness: **Vitest** (unit/contract) + **Playwright** (E2E) + **axe** (a11y), green in CI.
- [ ] **Unit** on the pure logic that carries into Part B: `availableSlots`, `applyKAnon`,
  `roomUtilisation`, `coverageNote`, the consent state machine, contrast helper, care-state derivation.
- [ ] **Provider-conformance** suite (from §2).
- [ ] **E2E happy-paths** on mock: booking flow, the counsellor day loop, sidebar collapse, theme toggle,
  360px — plus the **axe** pass. (These survive into Part B because the UI doesn't change.)
- [ ] **Hold for Part B** (do **not** write against mock — they prove nothing until real): RLS cross-org
  isolation, note/PII redaction at the data + payload layer, consent enforcement, role-guard integration,
  funder k-anon scoping, payment idempotency, the AI de-identify/no-audio-retention pipeline. These run
  against a **real ephemeral Postgres with RLS, connected as the app role** (never the owner/BYPASSRLS
  connection) — set up in Phase 10, written per phase.

**Done when:** the Part-A suite is green in CI and tagged as the regression guard for all of Part B.

## 8. Closeout ritual (your convention)
- [ ] Write `docs/completed/PHASE_A_COMPLETE.md` (what shipped + verification).
- [ ] Tick **Phase 8** ✅ + date in `ROADMAP.md`.
- [ ] Update **Current State** in `TO_START_EVERY_SESSION.md`.
- [ ] Open `docs/PHASE_9_PLAN.md` (auth + consent recheck).
- [ ] Commit `Part A complete + Phase 9 opens` and **tag** the Part-A-complete commit.

---

## Honest constraints
- **The seam is the whole game.** §1 + §2 are worth more than the rest combined; a leaky seam or a loose
  contract is what turns "swap" into "rewrite."
- **Mock-green ≠ proven.** Isolation, redaction, consent, k-anon, idempotency, and the AI pipeline are
  Part-B deliverables tested against real infra — a passing test against a mock is false confidence (Rule #4).
- **RLS tests must run as the app role.** As the table owner or with BYPASSRLS, every isolation test goes
  green for the wrong reason. Connect as the app role, set the per-request org/role session context the
  policies read, and prove isolation by reaching for another org's row and getting nothing.
- **Keep the Part-A E2E green through all of Part B.** The UI doesn't change between A and B (the design
  promise) — so any of those turning red while wiring is your early warning that a contract broke.

*Phila · philasa.com · Part A → Part B gate · Last updated 2026-06-26*
