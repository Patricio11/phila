# 🛡️ PHASE 31: COMPLIANCE & DATA-SUBJECT READINESS (POPIA × HPCSA)

*Goal: ship the legal-readiness layer — data-subject rights, retention clocks, breach log, the one-click
POPIA pack, and the broadened compliance test sweep — so Phila (and every org on it) is ready to process
real client special-category data. Consolidates the open POPIA items from Phase 19 and the compliance-test
items from Phase 20 into one deliberate phase.*

> **Status:** ⏳ not started. Plan doc; build against it cluster-by-cluster like the rest.
> **Relates to:** Phase 19 (POPIA hardening — DSAR/retention/DPIA/breach/POPIA-pack items move here),
> Phase 20 (compliance tests — the broadening lands in 31.6). **Data residency (SA region) stays in
> Phase 19** and is gated to first-real-client onboarding, *not* this phase.

> ### ⚖️ Governing principle — this phase must not complicate an org's life
> **Non-negotiable for every task here:**
> 1. **Zero new steps in the daily loop.** Booking, session, note, calendar, caseload are untouched.
> 2. **Correct by default, no config.** Every clock, gate, and policy ships with sane SA defaults; an
>    org never has to *set up* compliance for it to be correct.
> 3. **Admin surfaces are optional + view-first.** A single quiet "Data & privacy" area — used only when
>    someone asks to see/export/erase — never a mandatory new workflow.
> 4. **Phila carries the platform's own duties centrally** (Information Officer, sub-processor/DPA
>    register, DPIA, breach process) so orgs *inherit* them rather than each redoing the paperwork.
> 5. **On-demand, one-click.** DSAR export + the POPIA pack are a single click when needed — nothing ongoing.

> **Legal framing (drives the design):** Phila is an **operator** (processor); each org is the
> **responsible party** for its clients' data. So this phase is partly tooling Phila *gives orgs* to meet
> their duties, and partly Phila-the-company's own house. Reuses what's already built: soft-delete
> (`deletedAt`), the merge/de-identify machinery (`mergeClientsDb`), `consents` (purpose+version+ts),
> `audit_log` + `logAccess()`, the messaging `deliver` chokepoint, `runForOrg` RLS scoping, field
> encryption (`PHILA_FIELD_KEY`), and the entitlement/feature registry. Respects Rules #1, #3, #7, #8, #10.

---

## Task 31.1: Data-subject request (DSAR) tooling — export & erasure
*POPIA rights of access, correction, deletion. Assembly over new capture — the data already exists.*
- [ ] **Export ("everything we hold on this person").** One action (`exportDataSubject(orgId, clientId)` /
  the staff equivalent) assembles across the existing tables (profile, appointments, notes-metadata, care
  plans, documents list, consents, outcomes, demographics, audit of accesses) into a portable, **audited**
  file (PDF + machine-readable JSON in a ZIP). Org-scoped via `runForOrg`; platform version for staff/users.
- [ ] **Erasure / de-identification (lawful-where-possible).** Reuse the merge/de-identify path: for a
  "delete me" request, **de-identify the non-clinical PII** (name → pseudonym, contact/ID cleared) and
  **soft-delete + restrict-process** the record. Where HPCSA retention applies (31.2), the clinical record
  is **not** hard-deleted — it's de-identified-where-possible and held under its clock, with an honest,
  audited reason returned to the requester.
- [ ] **One quiet surface, no daily friction.** A "Data & privacy" panel on the client detail (org side)
  and member detail: **Export data** / **Handle deletion request** — used on request only. Optional
  **client self-service** in `/me` ("request my data" / "request deletion") that simply *routes the request
  to the org* (the responsible party) + notifies them; the org still runs the one-click action. No new
  mandatory step for anyone.
- [ ] Every export/erase writes a **fail-strict** `audit_log` entry (`dsar.export` / `dsar.erase`) — like
  the clinical-access audits, a DSAR can't proceed unlogged.

**Done when:** an org can, in one click, export everything held on a client and action a deletion request —
honoured where lawful, restricted-with-reason where HPCSA mandates retention — all audited, with an
optional client-initiated request that adds no work to the daily loop.

## Task 31.2: Retention clocks × HPCSA (the subtle one)
*POPIA "don't keep longer than needed — unless another law requires it" × HPCSA minimum retention.*
- [ ] **Per-record retention clock.** A computed `retain_until` per record type, from sane SA defaults:
  clinical records **≥6y from last entry**; **minors → until age 21**; **incapacity → indefinite**.
  Derived automatically from record type + client DOB/status — **the org never sets this.** *(Confirm the
  current HPCSA booklet numbers with an advisor before launch; encode them in one `lib/compliance/retention.ts`
  table so a change is one edit.)*
- [ ] **Pruner cron (fails closed, dry-run first).** A scheduled job destroys/de-identifies only records
  whose clock has expired **and** that are not under legal hold; ships in **report-only mode**, requires an
  explicit platform enable, is fully audited, and never touches a record inside its clock or on hold.
- [ ] **Erasure honours the clock.** 31.1's erasure checks `retain_until`: lawful → de-identify/destroy;
  mandated-retention → restrict-process + honest reason. The policy ("erasure honoured where lawful, refused
  with reason where mandated") is documented in `docs/SECURITY.md`.
- [ ] **Invisible to orgs.** Defaults are automatic; an admin can *view* a record's retention status in the
  Data & privacy panel but is never asked to configure it. The default policy is **platform-owned** (super-admin),
  inherited by every org.

**Done when:** every record carries an automatic HPCSA-aware retention clock, a dry-run-first pruner respects
it, erasure reconciles with it — and no org admin ever had to think about any of it.

## Task 31.3: Breach log + notification workflow (POPIA s22)
*Rare, platform-first, admin-initiated — not a daily tool.*
- [ ] **`breach_log`** table + a simple **super-admin** surface (`/admin/compliance/breaches`): record an
  incident (what, when, scope, severity, containment, status). Org-level view optional/read-only.
- [ ] **"Who was affected"** query — from the incident scope, identify affected data subjects to support the
  s22 notification to the Regulator + affected people (reuses `audit_log` + the data map).
- [ ] **Templated notification** via the Phase-12 `deliver` chokepoint (consent/opt-out honoured) — an
  assisted, admin-initiated action, never automated.

**Done when:** an incident can be logged, its affected subjects identified, and a notification drafted —
centrally, without adding anything to an org's normal use.

## Task 31.4: The one-click POPIA pack (a duty that doubles as a feature)
*The selling point: "compliance you can show the Information Regulator," assembled from data you already hold.*
- [ ] **Per-org, one action** (`generatePopiaPack(orgId)`): assembles consent records + lawful-basis
  evidence + the access audit trail + retention status + any breach entries into an exportable, audited
  PDF/ZIP. **Assembly, not new capture** — the raw material is in `consents` + `audit_log` + 31.2.
- [ ] **Sub-processor / DPA register** — a platform-maintained list (Neon, Supabase, Resend, BulkSMS,
  Meta/WhatsApp, the AI provider, Paystack) with each one's cross-border **s72 basis**, surfaced to orgs
  **read-only** and included in the pack. Phila fills it once; every org inherits it. *(The AI cross-border
  s72 basis is the existing consent-gate — document it here.)*
- [ ] Surface as a single **"Download compliance pack"** button in the Data & privacy area. Zero ongoing burden.

**Done when:** an org admin clicks once and gets an auditor-ready POPIA pack (their consents, audit, retention,
and Phila's sub-processor chain) — a genuine differentiator that costs them nothing to maintain.

## Task 31.5: DPIA + Information Officer + operator agreements (paperwork, tracked lightly)
*Mostly docs + a gentle, optional onboarding nudge — never blocking.*
- [ ] **`docs/compliance/`** set: the **DPIA** (template + Phila's completed high-risk-processing assessment),
  the **operator/DPA register** (31.4), and an **IO-registration checklist**.
- [ ] **Optional onboarding nudge:** a dismissible "Register your Information Officer with the Regulator"
  step with a link + a "done" checkbox — **never mandatory, never blocks** using the product.
- [ ] Phila-the-company registers its **own** IO + completes its **own** DPIA centrally, so the platform
  duties are met once.

**Done when:** the platform's own POPIA paperwork is on file, orgs get a one-link IO nudge they can dismiss,
and the DPA register/DPIA exist as living docs.

## Task 31.6: Broadened compliance test sweep (extends Phase 20)
*Lock the invariants now, while the surfaces are fresh, so a future change can't silently regress them.*
- [ ] **No PII in any cross-role payload.** Serialize the action/route payloads per role and assert no
  `session_notes.body`, contact, `national_id_enc`, or demographics leak to a role that shouldn't see them
  (extends the proven RLS isolation to the *payload* layer).
- [ ] **k-anon + consent on every export path.** Assert the small-cell suppression + k-floor + consent-gating
  on demographic/funder exports and the POPIA pack (Rule #10).
- [ ] **"AI-generated" labelling + AI never advances state.** Every AI draft surface carries the label; the
  AI never signs, sends, or moves clinical state (Rule #2).
- [ ] **Safeguarding never auto-actions.** A risk flag never triggers an automated action; it always surfaces
  a human + current resources (Rule #8).
- [ ] **Retention/erasure invariants.** Erasure honours-where-lawful / refuses-where-mandated; the pruner
  never destroys a record inside its clock or under legal hold; DSAR export is complete + audited.
- [ ] Runs in CI beside the existing `rls.test.ts` / `rls-scoped.test.ts` proof.

**Done when:** CI proves no cross-role PII leak, k-anon+consent on every export, AI labelling, no safeguarding
auto-action, and the retention/erasure invariants — the confidentiality guarantees are regression-locked.

---

### Honest constraints
- **This phase ships tooling, not legal sign-off.** The operator-vs-responsible-party split, the HPCSA
  retention numbers, and the erasure-vs-retention policy should be **confirmed by a POPIA-literate advisor
  before launch.** The build encodes them in one place (`lib/compliance/*`) so a correction is a one-line change.
- **Retention destruction is irreversible** — the pruner ships **dry-run/report-only**, requires an explicit
  platform enable, is fully audited, and is reversible until committed. Never auto-on.
- **Orgs stay uncomplicated.** If any task starts to demand org configuration or a new daily step, it's
  wrong — fold it into a sane default or a one-click on-demand action instead (the governing principle).
- **Residency is separate.** SA-region data-at-rest (Postgres + storage) is Phase 19, tied to first-real-client
  onboarding — not a blocker for building this phase against the current DB.

### Closeout ritual (your convention)
- [ ] `docs/completed/PHASE_31_COMPLETE.md` (what shipped + verification).
- [ ] Tick Phase 31 ✅ + date in `ROADMAP.md`; note the Phase 19/20 items it closed.
- [ ] Update **Current State** in `TO_START_EVERY_SESSION.md`.
- [ ] Commit `Phase 31 complete — POPIA/HPCSA readiness`.

*Phila · philasa.com · Phase 31 plan · Compliance & data-subject readiness · Last updated 2026-07-08*
