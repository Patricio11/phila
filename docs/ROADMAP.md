# PHILA  COUNSELLING PRACTICE PLATFORM ROADMAP (v1.0)

> **Name:** **Phila**  isiZulu / isiXhosa for *to heal / be well*  used everywhere in the system. The
> **domain is `philasa.com`** (web address only). Read with
> `TO_START_EVERY_SESSION.md` (rules + stack),
> `DESIGN.md` (design + UX/screens + the mock-data seam, all merged).
>
> **The shape of this plan (read this first):**
> **PART A (Phases 0–8)** builds the **entire product on mock data**  all roles, every surface,
> fully clickable and beautiful, demoable to an NGO or EAP. Nothing in Part A touches a real database.
> **PART B (Phases 9–20)** swaps mock → real **behind the `dataProvider` seam** (auth, the RLS data
> engine, scheduling, WhatsApp, LiveKit, the AI scribe, PayShap, funder analytics, SEO, hardening,
> tests, launch)  **with no UI change.** This is the Mock-First Rule made into a delivery plan.

---

## 🎯 EXECUTIVE SUMMARY

Phila is a multi-tenant operations platform for **counselling organisations** in South Africa. We do
not bill medical aid (GoodX/Healthbridge own that) and we are not a solo-therapist scheduler
(Bookem/Cliniko own that). We serve **multi-counsellor orgs that bill clients directly**  community /
NGO counselling, EAP & corporate-wellness providers, university and faith-based services  and scale
down to a single practice as the entry tier. The wedge is three things: a **daily clinical loop** good
enough to open ten times a day, **programme-grade Hub oversight**, and **funder/demographic reporting
that falls out of the clinical work** instead of being a second job. The AI scribe is the engine that
fuses the daily loop to the reporting.

Four roles, each a full workspace:
- **Client**  finds an org, books, intakes, joins sessions, sees their own journey.
- **Counsellor**  runs a daily caseload: calendar, sessions, notes, progress, uploads; may supervise.
- **Org admin (the Hub)**  oversight of every counsellor, staffing, rooms, intake, invoicing, reporting.
- **Super admin (platform)**  orgs, plans, the platform AI key, integrations, platform audit.

### Core Domain Rules
| Rule | Description |
|------|-------------|
| **Care-Confidentiality** | Everything is POPIA *special* personal info. Consent, encryption, audit, erasure from commit one. Notes never in a public/cross-org payload. |
| **No-Diagnosis / AI-Honesty** | Never diagnoses, never auto-advances clinical state. AI output is a draft a human signs; always labelled "AI-generated." |
| **Consent-Before-Capture** | No intake/demographics/notes without recorded, purpose-bound consent. Hub reading a note is an audited access. |
| **Mock-First** | Every surface built + demoable on the seam before any DB (Part A). Part B swaps provider with no UI change. |
| **Dormant-by-Default** | AI/video/WhatsApp/payments inert until an admin configures them. The AI toggle is also the POPIA cross-border consent gate. |
| **Tenant-Isolation** | Every tenant query bounded by `org_id` via Postgres RLS. Super-admin cross-org access is audited. |
| **Data-Residency** | PII rests in SA region before launch. AI inference de-identified before any cross-border call; ZDR; audio never stored. |
| **Safeguarding** | Risk flags first-class, never auto-actioned, always surface a human + current resources; never name a method. |
| **Responsive & Considered-Motion** | 360px-first on every surface; motion rich but GPU-cheap, capped, reduced-motion aware. |
| **Outcome-Honesty** | Analytics distinguish captured vs missing; demographic dashboards consent-gated; k-anon floor + small-cell suppression on any export. **Funders are read-only, scoped to their grant(s), see only aggregate/k-anon data, and every view is audited**  never an identifiable client. |
| **Cost** | AI/WhatsApp/SMS/video are metered platform-fronted costs; per-org caps; honest limit, never silent failure. |

### Roles
**Platform:** `super_admin` · `client` · **`funder`** *(external, read-only, scoped to specific grants
 see Phase 5.5; only ever sees aggregate, k-anonymised, consented data, every view audited)*.
**Org team** (a user's role *within* an org; a user can belong to several orgs): `org_admin` ·
`counsellor` (+`supervisor` flag, +room schedule) · `front_desk` / `intake_coordinator` · `finance` ·
`programme_manager`. Clinical-note access = authoring counsellor + supervisor only; all other note
access is audited (Rules #1/#3).

---
---

# 🟦 PART A  THE WHOLE PRODUCT ON MOCK DATA (Phases 0–8)

*Goal of Part A: a beautiful, fully clickable, mock-driven product covering all roles, that you
could demo tomorrow. Build on the `dataProvider` seam so Part B is a swap, not a rewrite.*

---

## 🧱 PHASE 0: FOUNDATIONS & POPIA SPINE ✅ (2026-06-27)
*Goal: a correct skeleton with the compliance + tenancy seams present before any real PII exists.*

### Task 0.1: Project skeleton
- [x] Next.js (latest stable, App Router, **no `src`**), TypeScript strict (`noUncheckedIndexedAccess`), ESLint/Prettier, Turbopack.
- [x] Tailwind v4 + shadcn/ui base; Lucide icons; design tokens (the neutral + green-accent palette, light/dark, motion tokens) in `app/globals.css` via `@theme`  exactly the approved system (`DESIGN.md` §2).
- [x] Folder layout:
  ```
  app/                 # route groups: (marketing) (public) (booking) (me) (app) (hub) (admin) (funder) (auth)
  components/          # ui/ (signature + primitives) + feature components
  db/                  # drizzle schema, client, queries, migrations, rls/ (Part B)
  lib/                 # auth, validation (zod), storage, scheduling, ai, contrast, audit, mock/
  lib/mock/            # the dataProvider seam + typed fixtures + helpers (DESIGN.md §11)
  emails/              # react-email templates (Part B)
  ```
- [x] Neon project + Drizzle client + drizzle-kit scaffolded (**no live connection in Part A**; document EU→SA residency note for Part B).
- [x] **English only**  no i18n framework, no locale routing, no catalogs. Copy lives close to its component (`DESIGN.md` §7).

### Task 0.2: POPIA + tenancy infrastructure (build NOW, even for mock)
- [x] `consents` shape + a versioned, purpose-bound consent util (state machine `none → granted(v) → revoked`). UI in Phase 2/3; persistence in Phase 9.
- [x] `audit_log` shape + `logAccess()` helper invoked on every (mock) PII read/export. Persistent table in Phase 10.
- [x] Field-level encryption util (`lib/crypto`, AES-GCM) for ID numbers / sensitive fields; key via env/KMS. Wired for real in Phase 10.
- [x] Soft-delete convention (`deletedAt`) + erasure-job stub.
- [x] **Tenant + RBAC guard scaffold** (`lib/auth/guard.ts`): `requireRole` / `requireOrg` / `requireOrgFeature`  mock-backed now, Better-Auth-backed in Phase 9. The **RLS** model is documented in `docs/SECURITY.md` now, enforced in Phase 10.

### Task 0.3: Design system + the `dataProvider` seam
- [x] Tokens + **Inter** (self-hosted via `next/font`, 400–700, tabular numerals; no serif, no monospace). The 8px/radius/shadow scale + motion + reduced-motion utilities (`DESIGN.md` §3, §4).
- [x] **Theme system:** light + dark from one set of CSS variables; a `system | light | dark` toggle persisted per user; no flash-of-wrong-theme (set before paint). The whole UI is theme-tokenised from commit one.
- [x] **PWA shell:** web app manifest + icons + a service worker registered; installable; an offline shell. The real **offline send-queue** lands with scheduling/notifications (Phase 11/12); scaffold the queue interface now.
- [x] The **`dataProvider`** interface + `mockProvider` (default in Part A) + typed fixtures + helpers (`DESIGN.md` §11). `DATA_PROVIDER=mock|db` env flag.
- [x] Performance budget documented (JS budget on key routes; no blocking media)  enforced in Phase 8/18.

**Done when (mock):** the app boots, tokens + fonts render in **both themes**, it is **installable as a PWA**, an example screen reads from `mockProvider`, and `npm run build` is clean across all routes.

---

## 🌐 PHASE 1: PHILA LANDING + ORG PUBLIC PAGE (SEO) ✅ (2026-06-27)
*Goal: the marketing face + each org's findable, editable front door. Mock data, production-grade UI.*
> Screen detail: `DESIGN.md` §9. The org page is the SEO surface (wired in Phase 17).

### Task 1.1: Phila landing  `/`
- [x] The full, sequenced landing page per `DESIGN.md` §9  product-led: a hero that **shows the real dashboard** beside a sharp headline + one CTA, the daily-loop demo, three pillars (asymmetric, each shown in product), the funder story, a specific POPIA/data-in-SA trust band, who-it's-for, one real voice, close. In the tool's own visual language. Built to completion  it sets the quality bar. No stat-hero, no competitor names, no medical-aid claims.

### Task 1.2: Org public page  `/o/[orgSlug]`
- [x] `<OrgPublicShell>`: hero (logo, `--brand-accent`, intro), About, **Services** (duration + price/enquire), **Team** (`<CredentialChip>`), location/online, prominent **Book** CTA.
- [x] SEO scaffolding: per-org `<title>`/meta/OG, JSON-LD (`LocalBusiness`/`MedicalBusiness`, honest non-diagnostic copy), `generateMetadata` from mock org data. SSR.
- [x] Contrast-safe `--brand-accent` via `lib/contrast.ts` (auto-darken on AA fail).

**Done when (mock):** any mock org renders a branded, SEO-tagged public page that links into booking.

---

## 📅 PHASE 2: BOOKING & INTAKE FLOW ✅ (2026-06-27)
*Goal: a client can book end-to-end from an org page  pick, time, intake, consent, confirm.*
> Screen detail: `DESIGN.md` §8. The slot logic mirrors the Phase-11 engine via `availableSlots()`.

### Task 2.1: Pick + time  `/o/[orgSlug]/book`
- [x] `<BookingShell>` progress thread; pick service + counsellor (or "any available"); calm slot picker honouring mock business hours / buffers / breaks / availability.

### Task 2.2: Intake + consent
- [x] Render the org's mock intake form; capture answers (resumable).
- [x] **Consent capture**  `<ConsentField>` per purpose (booking / notes / demographics / comms; **AI only if org `aiEnabled`**), versioned. Plain-language English.

### Task 2.3: Confirm
- [x] Summary + "we'll send a WhatsApp + email" (mock); lightweight account creation at confirm; success state with the new appointment on the client's thread.

**Done when (mock):** a full booking → intake → consent → confirmation clicks through on a phone.

---

## 🧍 PHASE 3: CLIENT PORTAL ✅ (2026-06-27)
*Goal: the client's calm home  their journey, sessions, documents, invoices, consent control.*
> Screen detail: `DESIGN.md` §8.

### Task 3.1: `/me` overview
- [x] Upcoming session card (with **Join** when online + link-ready, mock); today/next nudge.
- [x] The client's own **session history** (a clean timeline); previous sessions; recurring series.
- [x] **Always-reachable crisis support (2026-06-27):** a calm, never-alarming "If you need to talk now" card  **SADAG 0800 567 567** (free, any time, `tel:` link) plus the 10111 / nearest-hospital line. A counselling portal should never make a person in distress hunt for help.

### Task 3.1.5: Profile + mobile polish (2026-06-28)
- [x] **Client profile** (`/me/profile`, mobile-first): edit your details (name, mobile, email, **date of birth**, **home address**, **preferred contact**), an **emergency contact** block, a warm "your care team" note, and **Sign-in & security** (change password + 2FA). Backed by `getClientProfile` + client self-service actions (`saveClientProfile` / `changeClientPassword` / `setClientTwoFactor`, `requireClient`, audited). `SecuritySettings` now accepts action overrides so it's reused with client-scoped actions. Profile added to the client nav; account "Settings" points here. **99% of clients are on mobile**  single-column, large targets, no horizontal scroll.
- [x] **Home magic:** the "Your next session" hero now shows a **live countdown** ("in 2 days" / "in 3 hours" / "Happening now") and an **Add to calendar** action that downloads an `.ics` (with a 1-hour reminder)  straight into the client's phone calendar.

### Task 3.2: Records + control
- [x] Documents (mock uploads), invoices (mock, "pay" stub), profile editor.
- [x] **Consent centre**  view/revoke each purpose; honest state; revoke reflects immediately.

### Task 3.3: "From your counsellor"  care plan + updates
- [x] A calm **care-plan / session-updates** surface: what the counsellor chose to share after a session  advice, **between-session tasks** (with done/not-done), recommended resources, and the next step. This is the *shared* artifact only (never the private clinical note  Rule #1).
- [x] Tasks the client can tick off; gentle, never gamified, never pressuring. New shares arrive as a soft "update from your counsellor" notification (Part B wires the push/WhatsApp).
- [x] **"Your steps"  interactive, two-sided (2026-06-28):** the care-plan tasks are now a living loop. **Client** (`/me/steps`, mobile-first): a **progress ring**, **tap-to-tick** steps with a warm micro-celebration, and **gentle achievements** ("First step" · "Finding your rhythm" · "All steps done")  encouragement, *no points/streaks/shame* (honours the care ethic); resources + the counsellor's note below; a compact progress card on the home links in. **Counsellor** (client dossier): the same steps show **what the client has ticked off** ("2/3 done by Lerato") and an **Add a step** input puts a new, specific step in the client's portal. Actions: `toggleStep` (client) + `addCarePlanStep` (counsellor), both audited; `lib/care/steps` computes progress/achievements for both sides.

**Done when (mock):** a client sees only their own data, their thread, their care plan + tasks, and can walk their consents.

---

## 🩺 PHASE 4: COUNSELLOR WORKSPACE ✅ (2026-06-27)
*Goal: the daily clinical loop  the heart of the product  fully built on mock data.*
> Screen detail: `DESIGN.md` §8. AI scribe here is **mock** (real in Phase 14).

### Task 4.1: Today + calendar
- [x] `/app` today: `<AppointmentRow>` list, "starting soon" nudge, today’s counts, the create-appointment **FAB**.
- [x] `/app/calendar`: week resource view (desktop) / agenda (mobile); business-hours/buffer/break shading; drag-to-reschedule with a confirm step (no notification fires in mock).
- [x] **Multi-view calendar (2026-06-27):** rebuilt as a real `<CalendarView>`  **Day / Week / Month / Agenda** with ‹ Prev · Today · Next › navigation; a proportional time-grid (events sized/positioned by the minute, overlaps laid out side-by-side); a live "now" line; **click an empty slot → create-appointment, pre-filled** with that date/time. Replaces the old flat week grid (Hub `/hub/calendars` shares it, view-only on notes).
- [x] **Appointment detail (2026-06-27):** clicking a calendar event opens a calm `<AppointmentDetail>` card  client (linked), status, full date + time range, duration, counsellor, room/online  with **View client**, **Open session**, and **inline actions**: reschedule (date + time), mark Completed / No-show / **Postponed** / Cancel (the event updates live). The create-appointment modal can size a recurring series (**4 / 6 / 8 / 12 / 24 sessions or Ongoing**). **Reschedule runs a room/counsellor double-booking check** and warns before you confirm (a soft "move anyway"  Phase 11 enforces server-side).

### Task 4.2: Caseload + dossier
- [x] `/app/clients`: a clients **DataTable** (next/last session, status, risk flag); filter + search.
- [x] `/app/clients/[id]`: a details panel (contact, consent, demographics **only if consented**), the **session history** timeline, the **outcome trend** chart, documents.

### Task 4.3: Session + note editor (the loop's core)
- [x] `/app/sessions/[id]`: session details; **live in-session note-taking**  a calm split view that works *alongside* the video room or an in-person session, so the counsellor types as they talk (autosave, never blocks). This is the **private clinical note**.
- [x] **`<AIDraft>`** states off/mock/draft-ready ("AI-generated") → edit → **sign**; mark progress (completed / no-show / postponed); upload; online → **VideoRoom** entry (shell).
- [x] **Compose the client-facing care plan / summary**  a *separate* artifact the counsellor explicitly chooses to share with the client (advice, between-session tasks, resources, next step). The private note stays private; sharing is a deliberate action (Rule #1). The AI can draft the client summary too (labelled, edited, then shared).
- [x] Marking a session updates its row in the schedule + the client's session history + its quiet status dot (a calm cross-fade, honest count).
- [x] **Continuity of care (2026-06-27):** every session opens with a **"Since last time"** panel  session number in the journey, when the client was last seen, a recap of the previous note, and the **open care-plan goals**  so the counsellor picks up exactly where they left off. Plus **note-framework scaffolds** (SOAP · DAP · Brief) the counsellor can insert, never forced.

### Task 4.4: Supervision (if `supervisor`)
- [x] `/app/supervision`: queue of supervisee notes to review + sign-off; provenance is honest.
- [x] **Counsellor side trimmed (2026-06-28):** **Billing** and **Reports** removed from the counsellor workspace (they're Hub/admin concerns). Nav is Dashboard · Calendar · Clients · Sessions · Messages · Supervision · Rooms.
- [x] **Supervision built out (2026-06-28):** `/app/supervision` is now a real workflow  a **stats strip** (supervisees · awaiting sign-off · avg turnaround · signed this month), a **"Your supervisees"** panel (credential, caseload, pending count), and a **review queue** where each note expands to show the full clinical note (AI/safeguarding flags, submitted-ago), and the supervisor either **Signs off** or **Requests changes with feedback** (`signOffNote`, audited; safeguarding sorts to the top). **The Hub assigns supervision:** a member's **"Reports to"** supervisor is set in the Manage-member modal (`/hub/team/[id]`), choosing from counsellors flagged as supervisors (`saveTeamMember` carries `supervisorCounsellorId`). Supervisors see only their own supervisees.

### Task 4.7: Sessions list polish
- [x] **Sessions list (2026-06-28):** `/app/sessions` gains a **stat strip** (upcoming · today · completed · no-shows), **segmented filters** (Upcoming / Recent / All) and **client search**, with status word + room/online on every row. Client component over the same `listCounsellorSessions`.

### Task 4.8: Counsellor Rooms view
- [x] **Your week in rooms (2026-06-28):** `/app/rooms` is now visual  a **stat strip** (rooms assigned · days in office · in-person this week · sites) and a **"Your week"** time-grid showing the **room bands** you're assigned to (coloured) with your **in-person bookings overlaid**, so the gaps are obvious. Assignments list kept below as detail.

### Task 4.6: Counsellor account & settings
- [x] **Account settings (2026-06-28):** `/app/settings` is a real account area  **edit your own profile** (name, phone, **date of birth**, **home address**, languages, bio; email + credential read-only, managed by the practice), a **Security** card (**two-factor** + **change password**), and **Preferences** (theme, notification channels). Personal actions (`changePassword` / `setTwoFactor` / `saveMyProfile`) moved to a shared `lib/account/actions` and reused by both the counsellor and the Hub.

### Task 4.5: Messages  internal team communication
- [x] **Internal team messaging (2026-06-28):** `/app/messages` (counsellor) and `/hub/messages` (hub) are a two-pane chat for **staff-to-staff** communication  hub ↔ counsellor and counsellor ↔ counsellor (supervision, handovers, scheduling). Optimistic send wired to an audited `sendTeamMessage`; thread search; start a new conversation with any active colleague; day separators, unread badges, mobile back-stack. **This is internal/private to the practice**  client notices (booking, reminder, reschedule/cancel) go out over **SMS/WhatsApp**, configured BYO in Settings → Messaging channels and fired on booking events (Phase 12). Provider: `listTeamThreads(userId)` over a `teamThreads` fixture; the old client-chat view was replaced.

**Done when (mock):** a counsellor walks a full day  see calendar → open session → AI-draft a note → sign → mark completed → the thread updates.

---

## 🏢 PHASE 5: ORG-ADMIN HUB ✅ (2026-06-27)
*Goal: programme-grade oversight + the funder/demographic reporting differentiator. Mock data.*
> Screen detail: `DESIGN.md` §8.

### Task 5.1: Overview + calendars oversight
- [x] `/hub` overview: clients today/week/month, income + **income prediction**, no-show rate, open intakes, pending credential checks  all `<StatCard>` with honest coverage captions.
- [x] `/hub/calendars`: oversight of **every** counsellor's calendar (resource lanes); book on behalf; reschedule/cancel; allocate counsellor + **room**.
- [x] **Day/week/month depth (2026-06-28):** income is now **actual + predicted for today, this week, and this month** (not month-only), plus a **new-clients** stat (today · week · month). Spec-driven.
- [x] **Staffing load (2026-06-27):** a **"Team this week"** panel on `/hub`  every counsellor with their session count, a load bar against weekly capacity (amber when near capacity), credential status, and seen/upcoming split  the "who's stretched, who has room" view, paired beside "Needs attention".

### Task 5.2: Team, roles & clients
- [x] **Clinic access model (2026-06-28):** the **Hub (org admin) owns the record  full access to every client, note and upload**. A read-only `/hub/sessions/[id]` lets the Hub open any counsellor's clinical note (with care-plan + AI/sign provenance); **every open is audit-logged** (`note.read_hub_override`). Each **counsellor is scoped to their own caseload** (+ supervisees)  `/app/clients/[id]` 404s on another counsellor's client, and notes stay author+supervisor-only.
- [x] `/hub/team`: invite / add / deactivate team members and **set each member's org role**  `org_admin`, `counsellor` (+`supervisor`), `front_desk` / `intake_coordinator`, `finance`, `programme_manager`. Permissions differ per role (clinical-note access = counsellor + supervisor only; front desk schedules; finance bills; programme manager sees aggregate/consented reporting).
- [x] Counsellor credential status (HPCSA / ASCHP) + supervisor edges; **per-counsellor room schedule** (see 5.6).
- [x] `/hub/clients`: full list; reassign counsellor; **cancel/delete client with stats preserved** (Outcome-Honesty Rule  deletion never distorts compiled stats).
- [x] **Clients + team built out (2026-06-27):** `/hub/clients` gains a caseload summary strip (active · new · seen-this-week · safeguarding), a real **Add client** modal (name, SA phone, email, province, primary counsellor, optional safeguarding flag  validated + audited), and a working **Reassign** modal. Each client links to a new **Hub client page** (`/hub/clients/[id]`)  oversight overview (attendance, time-in-care, outcome trend, session history, care plan, consent, demographics, documents) that **explicitly excludes private clinical notes** (Care-Confidentiality Rule), with Reassign + Book. `/hub/team` clicking a member opens a real **Manage** modal (org role · supervisor toggle, counsellor-only · activate/deactivate, with a link to set their room schedule) and a working **Invite member** modal. **Bulk import (2026-06-27):** an **Import** action parses a pasted list or uploaded CSV (name, phone, email, province), shows a live preview, assigns all to a chosen counsellor, and imports (validated + audited, up to 500 at a time).
- [x] **Merge / dedupe (2026-06-27):** `/hub/clients` surfaces likely **duplicate** records (union-find over normalised name / phone / email  e.g. a double data-entry) in a banner; a review modal lets the admin pick which record to keep (session count + since-date shown) and **merge** the rest into it (`mergeClients`, audited). History is preserved, never duplicated  keeps reporting honest.
- [x] **Member page (2026-06-27):** each team member now opens a full profile at `/hub/team/[id]`  personal & contact (email, phone, **date of birth + age, address, languages, joined**), bio, **education & qualifications** (degree · institution · year) and specialties, role & access reach, and for counsellors: caseload stats, their **room schedule**, the linked **caseload**, and **upcoming sessions**  with **Manage** in place. Backed by `getTeamMemberDetail` + a `teamProfiles` fixture.

### Task 5.6: Rooms & resource management
- [x] `/hub/rooms`: room CRUD  name, **site/location**, capacity, equipment/features (e.g. play-therapy kit, wheelchair access), status (`active` / `maintenance`), and a colour for the calendar lane.
- [x] **Per-room schedule + utilisation:** each room shows *who is in it, when, and for what*  every booking (counsellor + client + type + time), plus utilisation stats (meetings this week, booked hours, % utilisation, busiest day). The honest "is this room over/under-used" view.
- [x] **Counsellor → room assignment (day/time):** assign a counsellor to a room on a recurring day/time pattern (e.g. "Nomsa  Room 2, Mon & Wed 09:00–13:00") *or* ad hoc per appointment. The scheduling engine (Phase 11) uses this to default + validate the room on every in-person booking and to **prevent double-booking** a room.
- [x] Multi-site aware: an org with more than one venue groups rooms by site; in-person booking respects the site.
- [x] **Rooms built out (2026-06-27):** `/hub/rooms` cards now link through to a full **room detail page** (`/hub/rooms/[id]`): live stats (utilisation %, booked hours, **free-to-book hours**, sessions, busiest day), a per-day **availability** breakdown (booked vs free), and a visual **week schedule grid** where every booking sits in place and **open slots are clickable to book straight into the room**. A working **Create / Edit room** modal (name, site, capacity, counselling equipment toggles, status, calendar colour) and an **Assign-counsellor editor** (pick counsellor + days + available time window)  both validated + audited (mock persistence lands Phase 11).

**Done when (mock):** the Hub can create rooms, see each room's full schedule + utilisation, assign counsellors to rooms by day/time, and every in-person appointment carries a conflict-free room.

### Task 5.3: Intake + invoicing
- [x] `/hub/intake`: send intake forms to a client / a programme cohort; track completion.
- [x] `/hub/invoicing`: create/send invoices (A4 builder); see paid / unpaid / cancelled (mock; PayShap in Phase 15).
- [x] **Intake + invoicing actions (2026-06-27):** intake gains a status summary (completed · awaiting · not-sent) and the **Send/Resend** action flips the row live. Invoicing gains an **overdue** total (unpaid past due, shown in red on the due date) alongside outstanding/paid, plus per-row **Mark paid** (live reconcile) and **Remind**  both validated + audited (`markInvoicePaid` / `sendInvoiceReminder`); honest that no message fires until messaging is connected. Clicking an invoice number opens a **read-only A4 preview** (org letterhead, bill-to, line item, VAT split, status stamp) with **Print / Download**.

### Task 5.4: Reporting (the differentiator)
- [x] `/hub/reporting`: filter clients by province / gender / age band / employment status / service; outcome trends (`<OutcomeTrend>` aggregate); **consent-gated**; **k-anon floor** on any export (`applyKAnon`); one-click funder report (mock PDF/CSV). Coverage caption everywhere ("412 of 530 clients have demographics").
- [x] **Funder narrative + real export (2026-06-27):** a **reporting-period** selector (this month / quarter / YTD / last 12 months) and an **auto-generated funder narrative**  a plain-English paragraph built from the live figures (reach by province, largest cohort, PHQ-9 direction with "lower is better"), with **Copy**. The **CSV downloads for real** (client-side Blob) carrying every breakdown with the **k-anon floor written through** (small cells render `suppressed (<k)`); the export stays audited. Nothing identifiable leaves the building.

### Task 5.5: Settings, payments & public page editor
- [x] `/hub/settings`: default duration, buffer, breaks; **business hours** (per-day enable + start/end); integration toggles (AI/video/WhatsApp) **dormant by default**.
- [x] **Settings built out (2026-06-28):** the page now opens with an **Organisation profile** (name, trading name, **registration/NPO**, **HPCSA practice no.**, contact email/phone, website, physical address  validated + audited via `saveOrgProfile`), a **Security** card (**two-factor** toggle + **change password** with strength/confirm checks), and **Messaging channels  BYO** (WhatsApp · SMS · Email each connect *your own* provider with credentials + Test, dormant until connected, via `connectChannel`). Existing Scheduling, Payments-BYO, Platform features (AI/Video), and Public-page editor are kept in a clean responsive layout.
- [x] **Editable working hours + calendar enforcement (2026-06-28):** business hours are now an **editable** per-day editor (toggle a day open/closed, set start–end) saved via `saveBusinessHours` (validated + audited). The **calendar enforces them**: closed days show "Closed" and aren't clickable; clicks outside the open window or inside a break don't open booking; month view hides "+" on closed days; and the **create-appointment modal rejects** a closed day, an out-of-hours time, a too-late start, or a break overlap. Phase 11 enforces the same server-side.
- [x] **Org payment connection (BYO gateway):** the org connects its *own* gateway so **clients pay the org directly**  pick a provider from the catalogue the platform enables (Stitch / Ozow for PayShap + pay-by-bank, Yoco / Paystack for cards), **switch it on, enter the org's own credentials** (stored encrypted), Test connection, set as default. Switching providers is one toggle. (Wired in Phase 15B.)
- [x] Public-page editor: edit §2.2 content + `--brand-accent` + SEO fields (mock save).

**Done when (mock):** the Hub demonstrates oversight of all counsellors, a consent-gated demographic filter, and a one-click funder report  the things incumbents can't show.

---

## 🤝 PHASE 5.5: THE FUNDER & GRANT MODULE + FUNDER PORTAL ✅ (2026-06-27)
*Goal: turn "the report writes itself" into a real surface  grants with targets, clinical work that
auto-rolls up to them, and a scoped, k-anon, read-only **funder portal**. The growth-loop differentiator.*
> This is the feature no incumbent in the niche has. Every funder-facing figure is **aggregate,
> k-anonymised, consent-gated (`funder_reporting` purpose), and audited**  a funder never sees an
> identifiable client (Rules #1, #10). The funder is an **external, read-only role scoped to its
> grant(s) only.** Mock data here; wired in Phase 16.

### Task 5.5.1: Funders & grants (Hub)  `/hub/funders`, `/hub/grants`
- [x] Funder CRUD (name, type: `government` / `lottery` / `corporate_csi` / `foundation` / `international`, contacts).
- [x] Grant CRUD: funder, title, **period** (start/end), amount + currency, restricted/unrestricted, **reporting schedule** (e.g. quarterly), status.

### Task 5.5.2: Indicators & targets (the logframe)
- [x] Per grant, define **indicators with targets**  `count` (e.g. "300 unique clients"), `percentage` (e.g. "60% female"), `outcome_delta` (e.g. "70% improve ≥5 on PHQ-9"), `demographic_proportion`. Each indicator carries a **computation rule** so its actual is derived from the clinical work, not typed.

### Task 5.5.3: Allocate clinical work to grants
- [x] Tag clients / programmes / services to a grant (`grant_allocations`)  "served under Grant X." This is what makes actuals auto-compute. A client can map to more than one grant (with honest de-duplication on counts).

### Task 5.5.4: Live indicators-vs-targets dashboard + narrative + report builder
- [x] Per-grant dashboard: each indicator as `<IndicatorMeter>` (actual vs target, **on-track / at-risk / behind**), demographic breakdowns, outcome trends, session counts  all **k-anon** with honest coverage captions.
- [x] Post **narrative updates** the funder will see; a **report builder** that maps indicators → the funder's required template; one-click period export (PDF/CSV/template). **Report-due reminders** against the schedule.

### Task 5.5.5: The Funder portal  `/funder` (role `funder`)
- [x] `<FunderPortalShell>`: a funder logs in and sees **only their grant(s)**  live progress vs target, k-anon breakdowns, outcome trends, session counts, the org's narrative updates, and downloadable period reports. Read-only. Nothing identifiable. Every view audited. The org controls exactly what each funder sees.
- [x] **Portfolio summary (2026-06-27):** the funder home now opens with an at-a-glance strip  total **committed**, number of grants, **active** count, and **organisations** funded  computed only from the funder's own scoped grants, before the per-grant cards.

### Task 5.5.6: Invite a funder (mock)
- [x] Org invites a funder contact (email); scoped to specific grant(s); the invite + scope is mock here (real flow in Phase 9).

**Done when (mock):** an org defines a grant with targets, tags clients to it, watches actuals roll up live, posts a narrative update, exports a funder report, and a funder logs into `/funder` to see only their grant  all k-anon, nothing identifiable.

### Honest constraints
- **Highest-risk surface for a privacy leak**  k-anon floor + small-cell suppression are mandatory; tiny programmes may legitimately show "too few to report."
- **Funder is read-only + scoped + audited**  never org staff, never a client, never cross-grant.
- **Aggregate only, consent-gated**  the `funder_reporting` consent purpose governs whether a client's (de-identified) data may roll into a funder figure at all.

---

## 🛰️ PHASE 6: SUPER-ADMIN CONSOLE ✅ (2026-06-27)
*Goal: the platform operator's console  orgs, plans, the AI rail, integrations, audit. Mock data.*
> Screen detail: `DESIGN.md` §8. 2FA eyebrow on every page (enforced in Phase 9).

### Task 6.1: Orgs, plans & platform billing
- [x] `/admin` overview (orgs, active team members, sessions 7d, AI spend, integration health, **subscription/MRR**).
- [x] `/admin/orgs`: create / suspend / configure; per-org plan + entitlements; **impersonate (audit-logged)**.
- [x] **Org detail / people directory (2026-06-27):** every row in `/admin/orgs` links to `/admin/orgs/[id]`  plan + billing + usage strip, plus the org's **people grouped by role** (Administrators · Counsellors · Operations) with credentials and reach, and the client count. Viewing is audit-logged; the seeded org shows its full directory, summary-only orgs show counts with an honest "loads on impersonation" note.
- [x] `/admin/plans`: tiers + per-feature AI/video/messaging/room entitlements, sourced from a `plans` table (no drift).
- [x] **Platform subscription billing:** orgs subscribe to a Phila plan and **pay Phila** through Phila's own PSP  invoices, trial, upgrade/downgrade, dunning. (This is distinct from an org's *own* gateway in 5.5, which is how the org's clients pay the org.)

### Task 6.2: AI rail, integrations catalogue & audit
- [x] `/admin/ai`: **platform-only** AI provider + key; off / mock / live + Test connection; model + max-tokens; **POPIA s.72 cross-border acknowledgement**; per-org spend caps; AI audit. Every org uses the platform key automatically (no BYO).
- [x] `/admin/integrations`: the catalogue of providers and what's available to orgs  WhatsApp · LiveKit video · **the payment providers an org may connect** (Stitch / Ozow / Yoco / Paystack) + Phila's own platform PSP. Enable/disable a provider platform-wide; off/mock/live + Test.
- [x] `/admin/audit`: platform-wide PII-access + admin-action ledger; CSV export (audit-logged).
- [x] `/admin/settings`: feature flags + platform settings.

**Done when (mock):** an operator can create an org, set its plan + entitlements, see platform subscription billing, toggle the (mock) AI rail, curate which payment providers orgs can connect, and read the audit trail.

---

## 🎬 PHASE 7: SIGNATURE SURFACES  CALENDAR, MODAL, VIDEO, AI, BUILDER ✅ (2026-06-27)
*Goal: the cross-role surfaces that make Phila feel like a finished, alive product. Mock data.*

### Task 7.1: The calendar
- [x] Resource calendar (counsellor + room lanes) on desktop / agenda on mobile; today ringed; business-hours/buffer/break shading; events carrying a quiet state dot; drag-to-reschedule with confirm. Keep domain logic **off** the calendar lib (RBC now; swap-ready for schedule-x/FullCalendar).

### Task 7.2: Create-appointment modal (used everywhere)
- [x] Client picker · service · counsellor · room or online · date·time·duration · **recurring** toggle · notes · send-confirmation. Bottom-sheet on mobile. Opened from FAB / slot / client / Hub.

### Task 7.3: Video room shell + AI scribe (mock)
- [x] `<VideoRoom>` pre-join (camera/mic check) + in-session controls + end→note; **paste-link fallback** variant when org video off. (LiveKit wired Phase 13.)
- [x] The `<AIDraft>` mock pipeline: "Generate draft" → labelled AI draft → edit → sign. Structured-extraction preview (the fields a funder report would use). (Real in Phase 14.)

### Task 7.4: A4 document builder
- [x] WYSIWYG A4 sheet for **Invoice / Intake / Report**: borderless fields, live totals, thin toolbar, print stylesheet. Fully responsive (fills phone, scrolls).

### Task 7.5: Outcome measures
- [x] PHQ-9 / GAD-7 capture + `<OutcomeTrend>` trend across sessions; honest "not yet measured" empty state.

### Task 7.6: KPI card refresh
- [x] **`<StatCard>` redesign (2026-06-28):** reworked from an icon stacked **on top** of the value to a calm **icon-left** layout (value leads, small tinted icon beside it). `icon` is now optional and a `tone` (default / warn / danger) colours the value + icon for warning metrics (overdue, safeguarding). Trend chip + honest coverage caption preserved. Applies across every dashboard at once; the Rooms summary cards delegate to it.

**Done when (mock):** calendar, create-modal, video shell, AI-draft, builder, and outcomes all click through and look finished.

---

## ✨ PHASE 8: STATES + RESPONSIVE + MOTION + A11Y  THE DEMO-READY GATE ✅ (2026-06-27)
*Goal: the entire product is a beautiful, clickable, mock-driven demo of all roles.*

### Task 8.1: Cross-cutting states
- [x] Every loading (`<RosterSkeleton>`), empty (instructional), error (calm/actionable), **blocked** (consent missing / feature dormant / over cost-cap  states the reason + next step), and offline/queued state, on every surface.

### Task 8.2: Responsive pass (360px-first)
- [x] Every surface verified at 360px incl. calendar (agenda), video room (fills screen), A4 builder (scrolls), org public page, all modals/sheets.

### Task 8.3: Motion + accessibility
- [x] The one page-load reveal + count settle + calm sheet/route transitions choreographed (`DESIGN.md` §4); **reduced-motion** strips movement, keeps clarity. (Sparse on purpose  over-animation is an AI-design tell.)
- [x] WCAG 2.2 AA sweep: keyboard-operate the calendar, focus rings, `aria-live` on counts/states, labelled controls, 200% text.

### Task 8.4: Theme + PWA pass
- [x] **Dark + light** verified on every surface (calendar, video room, A4 builder, dossier, public page); the `system | light | dark` toggle persists; no flash-of-wrong-theme; AA contrast holds in both.
- [x] **PWA:** installable on Android + desktop; offline shell loads; the offline send-queue **stubs** behave (queued booking/note shows a "will send when online" state). Real sync wires in Part B.

**Done when (mock):** a stranger can demo the whole product across all roles on a phone, **in either theme, installed as an app**, it looks finished and alive, and there are zero dead ends. **This is the Part-A ship gate.**

---

## ✅ PART A  COMPLETE (2026-06-28) · 🚪 CLOSEOUT GATE MET
*Whole product, all five roles, on the seam. Closeout: `docs/completed/PHASE_A_COMPLETE.md` + scorecard in
`docs/PHASE_A_CLOSEOUT.md`. Phase 9 plan: `docs/PHASE_9_PLAN.md`. Tagged `part-a-complete`.*

**Product: complete.** Every role + surface is built mock-first; clinical loop, Hub oversight, funder portal,
super-admin console, settings, internal messaging, "Your steps", auth/onboarding/invite  all click through;
`tsc`/`lint`/`next build` green; all routes 200.

**Seam + hardening: done (2026-06-28 hardening pass).** Zero `@/lib/mock` imports in app + components
(types/helpers moved to `lib/domain`; `lib/mock` is fixtures + provider only); the full `DataProvider`
interface is frozen and **proven by a conformance suite**; `dbProvider` is a throwing stub; `DATA_PROVIDER`
switch in place. **38 unit + contract tests green in CI** (GitHub Actions: tsc + lint + test + build). A
central injectable **clock** (`lib/clock.ts`, all 28 "now" call sites migrated) gives deterministic runs.
Typed **adapter interfaces** (`lib/adapters/`, Dormant-by-Default) are the Part-B attach points for storage /
notifications / AI / payments / video. Guards, `logAccess()`, consent utils, `db/` scaffold, `SECURITY.md` present.

- [x] **Provider-conformance suite** (§2/§7)  `tests/contract/`.
- [x] **Vitest unit + conformance harness in CI** (§7).
- [x] **Determinism** (§4)  `lib/clock.ts`, deterministic mock ids.
- [x] **Adapter interfaces** (§5)  `lib/adapters/`.
- [x] **Strict zero-`lib/mock`-import bar** (§1)  `lib/domain/{types,helpers}`.

- [x] **Closeout ritual** (§8)  `PHASE_A_COMPLETE.md` + `PHASE_9_PLAN.md` written, commit tagged `part-a-complete`.

**Remaining (small; none change the UI):**
- [ ] **Playwright E2E + axe** sweep (§7).
- [ ] Optional **loading/error mock flag** (§3)  states already drawn (Phase 8).

**Post-closeout Part-A refinements (2026-06-28)  depth the demo surfaced, all on the seam:**
- **Intake, end-to-end.** `/hub/intake` reviews what clients *submitted* (each answer + date), not just "send";
  and **the Hub owns its questions** at `/hub/intake/form`  a builder (add / reorder / delete; text · paragraph
  · phone · email · multiple-choice; Required / Confidential; live preview). No more hardcoded intake.
- **"Calendar" → "Appointments"** across counsellor + Hub (nav, routes, headings); "Booking" stays the public word.
- **`/hub/insights`**  internal management analytics (real counts, audited, consent-gated demographics, NOT
  k-anon): sessions today/week/month, attendance/no-shows, new+active clients, revenue, day+month trends, and
  client mix filterable by gender/age/location. Distinct from the funder Reporting.
- **`/hub/booking`**  per-org control of the public `/o/[slug]/book` flow, **enforced** by `getBookingConfig`:
  master switch, which services + counsellors are bookable, in-person/online, notice + horizon, intake-at-booking,
  deposit. **Notice + horizon are wired into the live slot picker** (`availableSlots` drops too-soon starts; the
  date picker caps at the horizon; enforced server-side via the clock) + 3 unit tests.
- **`/hub/services`**  the service catalogue (name · duration · price / "Enquire"); add / edit / delete,
  validated + audited. Cross-linked with Booking (catalogue here; who-can-book + modality there).
- **Booking flow polish**  client picks **online vs in-person** when a service offers both (validated
  server-side); the confirm step shows a **deposit** notice when the org requires one (collected Phase 13).
- **Booking → appointment wiring**  in-person assigns a free consulting room (real availability check);
  online mints a link via the **video adapter** (Dormant-by-Default  honest "link to follow" until live).
- **VAT, the SA way**  the **rate is national** (super admin → `/admin/settings`, default 15%, one change →
  every org) while **registration is per-org** (Hub → Settings ▸ Invoicing & VAT: registered toggle, VAT
  number, inclusive/exclusive pricing). Applied across the invoice builder + preview via a shared, tested
  `computeVat()`; "TAX INVOICE" only when registered.
- **Invoicing, fully per-org**  Settings ▸ Invoicing & VAT now also sets the **number prefix + payment
  terms** (invoices number themselves `PREFIX-YEAR-NNNN`, due dates follow), **banking details** (printed for
  EFT, invoice no. as the reference), and a **"Pay now" button** toggle on sent invoices  gated on the org's
  gateway being connected (Dormant-by-Default; collection wires up Phase 13).
- **Rooms ▸ Manage sites**  rooms already had full CRUD; now branches/sites are manageable too (name +
  province, add/rename/remove; a site with rooms can't be removed).
- **Client billing parity (`/me/billing`)**  the client now opens the **same A4 invoice** (VAT, banking,
  reference) the Hub issues, and the **"Pay now" button is gated by the org's toggle + connected gateway** 
  consistent with the Hub. When online pay is off but banking is set, the client sees a clear "Pay by EFT" cue.
- **Two-gateway model, explicit**  the org's **own BYO gateway** (whichever payment integration it enables)
  is for **client invoices**; **Phila's platform PSP** (system gateway) collects the org's **subscription**.
  New org-facing **"Your Phila plan"** card in Settings (plan, price, renewal, billed-by) sits beside
  "Payments  your own gateway" so the split reads as a pair. Adapter already models `surface:
  platform | org_gateway`. **Roles stay Hub / counsellor / client.**
- New seam methods `getIntakeBoard` · `getIntakeForm` · `getBookingSettings` · `getHubInsights` · `saveServices`
  · `getPlatformSettings` · `getInvoiceSettings` · `saveSites` · `saveInvoiceSettings` · `savePlatformVat`;
  `BookingConfig` carries `enabled` · notice/horizon · `serviceModalities` · `deposit`; `InvoiceSettings` carries
  VAT · numbering · terms · banking · `showPayButton`.

---
---

# 🟩 PART B  WIRE IT REAL (Phases 9–20)

*Goal of Part B: swap mock → real behind the `dataProvider` seam, light up integrations, harden for
POPIA, test, and launch  **without changing the Part-A UI.***

---

## 🔐 PHASE 9: IDENTITY, AUTH & CONSENT
*Goal: real accounts, all roles, multi-tenant sessions, and lawful consent.*

> **▶ Part B is live (2026-06-28).** Neon Postgres connected; `DATA_PROVIDER=db`. The **mock→real swap is
> proven end-to-end on a vertical slice**: Better Auth (email+password) over Drizzle/Neon; the session +
> guards resolve the **real principal from the DB** (unchanged `Principal` shape → zero call-site changes);
> real login routes every role to its home; unauth → `/login`. `dbProvider` is a **hybrid** (spreads the mock,
> overrides `getOrg`/`getOrgBySlug` with real reads, falls back to mock elsewhere) so the app stays whole as
> it migrates method-by-method. The DB is seeded from the fixtures with **matching ids**, so fallback and real
> reads agree. Verified: 45 unit/contract + **6 Playwright E2E** (login per role, wrong-password, guard
> redirect) with screenshots in `/screenshots`.
>
> **Working method for the rest of Part B (standing):** seed **all** mock data into the DB as each entity's
> schema lands (production-real, nothing forgotten); every phase ships **unit + Playwright E2E + screenshots**.
>
> **✅ Phase 9 COMPLETE (2026-06-29).** Real accounts for every role; persisted **consent** (versioned, audited)
> + persisted **audit_log**; real **sign-up** (creates org+admin); **TOTP 2FA** (enrol + sign-in challenge,
> gated to enrolled users only). Verified: 45 unit/contract + **9 Playwright E2E** (incl. consent-persists,
> sign-up, full 2FA loop) with screenshots. Details: **`docs/completed/PHASE_9_COMPLETE.md`**. Demo accounts:
> **`docs/DEMO_LOGINS.md`** (all `phila1234`).

### Task 9.0: Auth + onboarding UI shells (Part A, 2026-06-28)
- [x] **Beautiful auth surface, mock-first** (real auth lands in 9.1–9.2 behind these exact screens). A warm branded **`AuthShell`** (gradient brand panel + POPIA/data-in-SA/private-notes trust signals on desktop; slim header, single-column on mobile). **`/login`** (email + password with **show/hide eye**, forgot-password link, "explore a demo workspace" quick-access), **`/signup`** (practice registration  name, your name, work email, **password strength meter**, province, POPIA agree → onboarding), **`/forgot-password`** + **`/reset-password`** with calm success states. Marketing CTAs now route to **Sign in / Get started**. The Security card password fields (Hub/counsellor/client) upgraded to the same eye-toggle + strength + **"passwords match"** indicator.
- [x] **Onboarding wizard** (`/onboarding`): a 4-step flow  practice basics → working hours → **verification documents** → done  with a progress bar, smooth steps, Skip, and a celebratory finish → the Hub. `completeOnboarding` (mock).
- [x] **Platform-controlled onboarding requirements** (your call): the **super admin** configures the **documents every new practice must upload** at `/admin/onboarding` (toggle required/optional, add/remove; `saveOnboardingRequirements`, audited). The onboarding wizard **reads that exact checklist** (`listOnboardingRequirements`) for its upload step  so the platform owns the verification gate, and the practice (Hub) uploads to satisfy it.
- [x] **Document review (2026-06-28):** the admin org detail (`/admin/orgs/[id]`) shows each practice's uploads with status (verified · awaiting review · sent back · not uploaded), filename + age, and **Verify / Send-back** actions (`reviewOnboardingDoc`, audited). An overall **verification badge** (Verified / Pending / Action needed) rolls up and gates payouts + funder sharing. `getOrgOnboardingReview` merges requirements with per-org submissions.
- [x] **Client invite + activation (2026-06-28):** the Hub can **Invite a client to their portal** from the client page  over **WhatsApp / SMS** (their number) or **email**, offering only the channels the org has enabled *and* has details for (`inviteClientToPortal`, audited). The client taps the link → **`/activate`** (set a password → their `/me` space). The **auto-register-at-booking** path is wired too: the public booking success now says "your private space is ready" with a **Set up your account** CTA into the same activation page.
- [x] **Team invite + activation (2026-06-28):** the Hub invites a counsellor / team member from `/hub/team` (Invite member) and can **(re)send a setup link** from the member page (`sendSetupLink`, audited). **`/activate` is now role-aware**  a team invite (`?role=counsellor|org_admin`) reads "Welcome to the team · access your workspace" and lands them in **/app** or **/hub**; a client invite keeps the warm portal copy and lands in **/me**. One activation page, the right destination per role.

### Task 9.1: Better Auth setup
- [x] **Better Auth + Drizzle adapter; email+password; sessions in Postgres** (2026-06-28). Verification + forgot/reset still to wire (Phase 12 notifications).
- [x] **Role model + sign-in routes by role** (2026-06-28): platform role on the user (`client | funder | super_admin`, null for org staff) + org `team_role` in `org_members`; the sign-in Server Action routes each role to its home; multi-org membership resolved from the DB. Org switcher still to add.
- [x] **Guards backed by real identity** (2026-06-28): `requireAuth`/`requireOrg`/`requireHub`/`requireClient`/`requireFunder`/`requireSuperAdmin`/`requireCapability`/`requireOrgFeature` resolve the real session; unauth → `/login`. `requireFunderGrant` scoping already enforced in the provider.
- [x] **2FA (TOTP)** (2026-06-29)  Better Auth twoFactor: enrol (QR + backup codes + verify) in Security settings; the sign-in challenge appears **only for enrolled users**; disable flow. Tested end-to-end.

### Task 9.2: Sign-up + consent persistence
- [x] **Practice sign-up (org_admin, org-created)** (2026-06-29): `registerPractice` creates the org + first admin (Better Auth) → onboarding. Other roles arrive via invite/booking activation (those flows exist as shells; full creation lands as their clusters migrate).
- [x] **Consent state machine persisted** (2026-06-29): `consents` (purpose + version + timestamp); `getClientConsents` reads the DB; the consent centre's toggle upserts via `setConsent` (grant bumps version; revoke keeps it), audited. A change survives reload (E2E).
- [x] **Audit-log persistence** (2026-06-29): `logAccess()` writes to `audit_log` under `DATA_PROVIDER=db` (swappable sink, no call-site change). `/admin/audit` + Hub note-access read from it as those reads migrate.

**Done when:** real auth + consent back the Part-A UIs unchanged; every PII read writes an audit row. ✅ **Met.**

---

## ⚙️ PHASE 10: THE DATA ENGINE  SCHEMA + RLS + QUERIES + STORAGE
*Goal: the schema, tenant isolation, and integrity everything stands on. The mock→db swap.*

> **✅ COMPLETE (2026-06-29).** Built cluster-by-cluster on the hybrid `dbProvider` (real where migrated,
> mock fallback only for seeded M&E aggregates; the DB is seeded from the same fixtures via `db/seed-all.ts`,
> so the two always agree). **Done:** identity + tenancy (Phase 9), **consent + audit** (persisted), and five data
> clusters each with schema + seed + real reads + a DB-write E2E proof: **directory** (clients, counsellors,
> services, sites, rooms, demographics), **appointments** (`listCounsellorSessions`/`listAppointmentsFor*`),
> **clinical** (care plans, documents, outcomes  `getCarePlan`/`listClientDocuments`), **billing**
> (invoices  `listClientInvoices`/`listOrgInvoices`), and **funders/grants** (M&E tables + `listFunders`/
> `listFunderGrants`). The **home dashboards are now real too**: `getHubOverview` + `getCounsellorDashboard`
> aggregate DB rows via pure, unit-tested `compute*` functions in `lib/domain/dashboards.ts` (so calendar +
> home read the SAME appointments). **Writes now persist too**  the `db/queries/*` typed layer is live and
> four mutation clusters write real rows (each with a DB-write E2E): **bookings** (public booking →
> client + appointment + consent + room allocation), **catalogue** (services/rooms/sites), **appointment
> lifecycle** (create/reschedule/mark), and **settings/care/invoicing** (mark-paid, care-step ticks, business
> hours). `listCaseload` reads live data too. **RLS (10.2)** is authored, applied, and proven as the non-owner
> role (5-test leak proof). **Deliberately deferred** (not Phase-10 work): the payments/comms/AI/public tables
> land with their feature phases (12/14/15); the seeded M&E aggregates (`getReporting`/grant views) migrate
> with Phase 16; Storage lands with the clinical documents feature (14); the RLS *runtime cutover* + select-list
> redaction are the Phase 19 hardening pass. 17 migrations on Neon; **21 Playwright E2E + 56 unit/contract/RLS
> green.** See `docs/completed/PHASE_10_COMPLETE.md`.

### Task 10.1: Drizzle schema
- [x] Tenancy + identity (Phase 9): `orgs`, `org_members` (+ `team_role`, `is_supervisor`), Better Auth `user`/`session`/`account`/`two_factor`. **Directory** (2026-06-29): `counsellors` (credential flattened), `clients` (soft-delete), `services`, `demographics`. Deferred to their feature phases: `session_notes` (table exists; wired with clinical, Phase 14), `recurring_series` + `room_assignments` (Phase 11 scheduling), `intake_forms`/`intake_responses` (with the intake-builder feature).
- [x] **Rooms + appointments** (2026-06-29): `sites`, `rooms` (capacity/equipment/status/colour), and `appointments` (org_id, client, counsellor, service, type, `room_id`, startsAt, duration, state, tags). `room_assignments` (the recurring schedule) lands with Phase 11; utilisation stays derived.
- [x] **Client-shared care (2026-06-29):** `care_plans` (the shared artifact, distinct from `session_notes`) with `tasks` (between-session tasks + done state) and `resources` as JSONB; seeded + RLS'd. `getCarePlan` reads it; `toggleStep` writes task done-state.
- [x] **Funders & grants (M&E) (2026-06-29):** `funders`, `funder_contacts` (user ↔ funder, scoped to grants), `grants`, `grant_indicators`, `grant_allocations`, `grant_narratives`  all seeded + RLS'd. `listFunders`/`listFunderGrants` read the DB; `getGrantView`/`getReporting` aggregate them (mock-delegated until Phase 16 writes them  DB seeded from the same fixtures, so identical).
- [x] POPIA: `consents` (persisted, versioned), `audit_log` (persisted)  Phase 9. `demographics` + `outcome_measures`  seeded + RLS'd (directory/clinical clusters). `risk_flags` stays a boolean on `clients` until the safeguarding feature needs its own table.
- [ ] **Deferred to each feature's phase (not Phase 10):** Payments `subscriptions`/`payment_connections`/`payments` → **Phase 15**; Comms `notifications`/`message_templates` → **Phase 12**; AI `ai_jobs`/`usage_events`/`ai_providers` → **Phase 14**; `org_public_pages` (editable public content) → with that feature. Creating these as empty tables now (nothing reads/writes them) is busywork; they land when their phase wires them.
- [~] Enums per Appendix  in use across the schema. Performance indices (btree on `org_id` + FKs, `room_assignments(room_id, day)`, GIN where searched) tuned in **Phase 11** (scheduling engine) / pre-launch, when query shapes are final.

### Task 10.2: Row-Level Security (the real isolation boundary)
- [x] **Policies authored + applied + proven (2026-06-29).** `db/rls.sql` (idempotent, applied via `npm run db:rls`): a non-owner `phila_app` role (no `BYPASSRLS`), `ENABLE`+`FORCE` RLS on **every** org-scoped table  13 with a direct `org_id` policy (`appointments, audit_log, client_documents, clients, consents, counsellors, funders, grants, invoices, org_members, rooms, services, sites`), `orgs` by `id`, the clinical children (`care_plans, demographics, outcome_measures`) via `clients.org_id`, the M&E children (`grant_allocations/indicators/narratives`) via `grants.org_id`, `session_notes` via `appointments.org_id`, and `funder_contacts` via `funders.org_id`. Policies key off `app_current_org()` / `app_is_super()` (request GUCs). `super_admin` crosses orgs via the explicit `app.is_super='on'` escape (audited at the app layer). **Proof:** `tests/integration/rls.test.ts` (5 tests) connects **as `phila_app`** and asserts deny-by-default (no context → 0 rows), per-org isolation (masizakhe can't see a probe org's client), correct own-org visibility, **cross-org INSERT rejected by `WITH CHECK`**, and super-admin cross-org visibility. The owner (migrations/seed/auth) keeps `BYPASSRLS`, so this is inert for those paths and the 20 E2Es stay green.
- [ ] **Runtime cutover → deferred to Phase 19 (security hardening).** Point the request path at `DATABASE_URL_APP` (the `phila_app` role) and set the org GUCs per request. Mechanism is **proven**: drizzle's neon-http driver has **no** transaction support, so this needs the neon-serverless **WebSocket Pool** (`drizzle-orm/neon-serverless`, `neonConfig.webSocketConstructor = WebSocket`) + a `withOrgContext(orgId, isSuper, fn)` that opens a tx, `set_config`s the GUCs, and stashes the tx in `AsyncLocalStorage` so each provider method's existing `getDb()` runs under RLS  verified working against Neon (masizakhe ctx → its rows, wrong-org ctx → 0). Public-by-design reads (by slug, no org yet) stay on the owner. **Why deferred:** the app-layer `where org_id = …` is already the primary, in-place boundary; DB RLS is a *proven* second layer that activates on this flip; the cutover is a real refactor (per-method wrapping, org-id threading into id-only writes) better done as a deliberate hardening pass than rushed mid-Phase-10. Not a blocker for anything else.

### Task 10.3: The real `dataProvider` + integrity
- [x] **`dbProvider` matching the mock interface, UI unchanged (2026-06-29).** Built as a **hybrid**: spreads the mock, overrides per cluster. Migrated: `getOrg`/`getOrgBySlug`, `getClientConsents`, directory (`listClients`/`getClient`/`listCounsellors`/`getCounsellor`/`listServices`/`listSites`/`listRooms`), appointments (`listCounsellorSessions`/`listAppointmentsForCounsellor`/`listAppointmentsForOrg`), clinical (`getCarePlan`/`listClientDocuments`), billing (`listClientInvoices`/`listOrgInvoices`), funders (`listFunders`/`listFunderGrants`), the composite dashboards (`getHubOverview`/`getCounsellorDashboard`), and the caseload (`listCaseload`). The only mock-delegated reads left are the seeded M&E aggregates (`getReporting`/`getGrantView`/`getFunderGrantView`)  they migrate with Phase 16's funder tools that write those tables; until then the shared seed makes them identical.
- [~] Typed query fns in `db/queries/*` (no raw queries in components); Server Actions + Zod on every mutation; `logAccess()` on every PII path. **Live (2026-06-29):** `db/queries/{booking,catalogue,appointments,settings}.ts`; booking, services/rooms/sites, create/reschedule/mark, mark-paid, care-step toggle, and business hours all persist in db mode (each with a DB-write E2E). Remaining mutations to wire: intake-form save, org profile/branding, booking + invoice settings, team/client invites, note signing.
- [ ] **Select-list redaction → Phase 19 (security hardening, with the RLS cutover):** `session_notes.body`, contact, `national_id_enc`, demographics never selected on a shared/cross-role path. (Reads are already org-scoped + audited; column-level redaction is a hardening pass.)
- [ ] **Storage → with the documents feature (Phase 14 clinical):** private buckets, signed URLs, service-role server-only, magic-byte sniff + size limits + per-user rate limit, every file access audited. Document *metadata* already persists + reads from `client_documents`; real file upload/serving lands when the clinical document feature goes live, not as bare infra now.

**Done when:** `DATA_PROVIDER=db` runs the whole product on Neon with no UI churn, every cluster's reads + writes persisting. RLS policies are authored, applied, and proven at the DB now; **enforcing** them on the live request path (connecting as `phila_app`) is the Phase 19 hardening cutover  the app-layer `where org_id = …` is the primary boundary until then.

---

## 🗓️ PHASE 11: SCHEDULING ENGINE ✅
*Goal: real availability, rooms, room-assignments, and recurring series behind the Part-A calendar.*

> **✅ COMPLETE (2026-06-29).** Real availability (booking reads the persisted org's editable hours + real
> clash data), **race-free no-double-booking** enforced by GiST `EXCLUDE` constraints, room allocation
> defaulting from `room_assignments` + real `/hub/rooms` utilisation, **recurring edit-this/all** (series_id +
> this/all-following on reschedule & cancel, with reason), and a durable **offline send-queue** that syncs on
> reconnect with a real conflict re-check. 67 unit/integration + E2E green. See
> `docs/completed/PHASE_11_COMPLETE.md`.

- [x] **Availability engine (2026-06-29):** the pure `availableSlots(org, date, existing, …)` already mirrors
  production (business hours, breaks, buffer, min-notice, clash). Booking now feeds it **real** inputs 
  `dbProvider.getBookingConfig` swaps in the persisted org (real, admin-editable business hours), and clash
  data is the real per-counsellor DB appointments. So changing hours actually moves the slots.
- [x] **Room allocation (2026-06-29):** in-person bookings allocate a room, **defaulting from the counsellor's
  `room_assignments`** (day/time window) and falling back to first-free; multi-site aware via the assignment's
  room→site. **Double-booking is prevented at the DB**  GiST `EXCLUDE` constraints (`db/scheduling.sql`,
  `npm run db:constraints`) reject any overlapping counsellor *or* room booking, race-free and atomic; the
  actions surface a friendly "that time was just taken". Proven by 4 integration tests.
- [x] **Room utilisation rollups (2026-06-29):** `/hub/rooms` overview + detail (`getRoomsOverview`/
  `getRoomDetail`) roll up meetings, booked hours, % utilisation, busiest day, and per-day occupancy from
  **real** appointments + assignments. Proven by E2E (a live booking shows on the room detail).
- [x] **Recurring-series edit-this/all (2026-06-29):** `appointments.series_id` links a weekly series;
  `rescheduleAppointment`/`cancelAppointment` take a `scope` (`this` | `following`)  "following" acts on this +
  every later session (the reschedule shift is one statement so the deferred constraints see only final
  positions). Cancel carries a **reason** (`cancel_reason`). UI: a "Weekly series" badge + a This/All-following
  toggle on reschedule **and** cancel. Care-state transitions persist via `markProgress`.
- [x] **Offline send-queue (PWA) (2026-06-29):** durable IndexedDB queue (`lib/pwa/offline-queue.ts`) + a pure
  `processQueue()`; `flushQueue` replays each item against the real server action, so a slot taken while offline
  comes back a **conflict**, never a fake "sent". A global honest indicator (`offline-indicator.tsx`)
  auto-flushes on reconnect; the booking wizard queues when offline. Proven by an E2E (book offline → queued →
  reconnect → real appointment).
- [x] Calendar + booking + Hub oversight read real availability (the reads above are all DB-backed).

---

## 💬 PHASE 12: NOTIFICATIONS (WHATSAPP + EMAIL + SMS) ✅
*Goal: instant, honest booking/cancel/reschedule/reminder notifications  WhatsApp-first.*

> **✅ COMPLETE (2026-06-29).** Channels (WhatsApp BYO via Meta Cloud API; SMS via Phila BulkSMS credits; Email
> via Phila domain with practice reply-to + credits), routed by the client's preferred contact; a hub-editable
> template manager; the deliver chokepoint (resolve → POPIA gate → meter → honest `message_log` states); all
> five triggers + a T-24h/T-1h reminder sweep; super-admin manual credit grant; opt-out (STOP) + delivery
> webhooks; and a Recent-activity view. 79 unit/integration green. Self-serve credit purchase is **Phase 15.1**.
> See `docs/completed/PHASE_12_COMPLETE.md`.

> **Model (decided 2026-06-29):** the org enables any of **WhatsApp / SMS / Email** per channel; each message routes by the **client's preferred contact** among the enabled channels (Phila already captures `preferredContact`), with a fallback order. **Opt-out + quiet hours always win** (POPIA). Channels are dormant-by-default and never fake a "sent".
> - **WhatsApp = BYO (Meta Cloud API).** Each org connects its **own** WhatsApp Business number  Meta ties sender identity, templates, and quality to the org's WABA, so one shared number can't work. Org enters Phone Number ID, WABA ID, Access Token, App Secret, Verify Token (encrypted at rest); Configured → Live with a Test Connection; a "Help me set up" path for orgs without a WABA. 24h-window aware (approved templates outside it). Not Phila-metered  the org pays Meta.
> - **SMS = Phila system bulk + credits.** One platform integration (**BulkSMS.com**) serves every org; orgs buy **Phila SMS credits**. No per-org SMS account. Metered + capped.
> - **Email = Phila send + practice identity + credits.** Phila sends from its **own verified domain** but with the **practice as the display name and Reply-To = the practice's email** (best deliverability, zero org setup, replies reach the practice). Orgs buy **Phila email credits**. BYO sending domain is a later premium.
> - **Credits = balances + append-only idempotent ledger + caps.** 0 balance → send blocked with an honest "top up" nudge (never a fake send). WhatsApp (BYO) is uncounted. **Self-serve credit purchase lands in Phase 15.1** (needs the platform gateway); until then, top-ups are a super-admin manual grant with an honest "self-serve purchase arrives with billing" state for orgs.

### Task 12.1: Schema + credits model
- [x] `org_messaging_settings` (per-channel enable, email reply-to/from-name, quiet hours), `whatsapp_connections` (BYO Meta creds, **encrypted**, status off/configured/live), `credit_balances` (org × channel), `credit_ledger` (append-only, idempotency-keyed), `message_log` (honest delivery state), `message_templates` (system defaults + org overrides), `message_opt_outs`. Migration + seed (system templates, demo balances) + RLS on every org-scoped table.

### Task 12.2: Org **Notifications** settings (Settings → Notifications)
- [x] WhatsApp **BYO credentials card** (the YetoEFT/`payment-connection-card` pattern): provider creds, Test connection, Save (encrypted), "Help me set up". SMS + Email rows: **powered by Phila**, balance + **Buy credits**, email Reply-To. Per-channel enable toggles. Routing + quiet-hours editor.
- [x] **Template manager (hub-editable):** the hub views every message (channel × trigger), edits the wording (live token preview, e.g. `{clientName}`/`{date}`), and **resets to the Phila default**. Edits write an org-override row in `message_templates`; the system defaults (org_id null) are the fallback. WhatsApp template-name field for Meta-approved templates (outside the 24h window).

### Task 12.3: Send pipeline (one chokepoint) + real transports
- [x] `lib/messaging/deliver.ts`: resolve recipient + preferred channel → POPIA gate (consent/opt-out/quiet hours) → transport select (org Meta · Phila BulkSMS · Phila email) → **meter** (SMS/Email decrement credits; 0 = block) → transmit (WA 24h-window/template) → record honest `message_log` status → audit. Pure `resolveChannel` / `decideSend` (unit-tested). Transports: Meta Cloud API, BulkSMS, Resend.

### Task 12.4: Triggers
- [x] booked / rescheduled / cancelled / **reminder (T-24h, T-1h)** / no-show  wired into the existing booking/reschedule/cancel/markProgress actions (replacing their "no message sent yet" honesty notes). Reminder sweep endpoint.

### Task 12.5: Platform side
- [x] Super-admin: Phila's **BulkSMS + email** provider credentials (system-wide) in `/admin/integrations`; credit pack pricing; **manual credit grant** (until Phase 15.1).

### Task 12.6: Opt-out + quiet hours + delivery webhooks
- [x] STOP/opt-out handling; quiet-hours enforcement; WhatsApp + email **delivery-status webhooks** update `message_log` (sent → delivered/failed); dead-letter on retry exhaustion.

**Done when:** a real booking/reschedule/cancel/reminder reaches the client on their preferred channel (WhatsApp via the org's number, SMS/Email via Phila credits), metered + capped + audited, with honest delivery states and opt-out/quiet-hours respected.

---

## 🎥 PHASE 13: VIDEO (LIVEKIT) + PASTE-LINK FALLBACK ✅
*Goal: real online sessions, owned and in-region, or the org's own link.*

> **✅ COMPLETE (2026-06-29).** Real, self-hosted **LiveKit** video  proven end-to-end against a local
> Docker server (a Playwright test joins the room and connects). Server-side token minting + signed,
> unguessable join links; a beautiful branded **waiting room** (camera/mic preview, device pickers, calming
> copy) → a full **call** (camera toggle for audio-only, mic, screen share, chat, leave). Wired into the booking
> confirmation, the client portal, and the counsellor's session. Self-host setup in `phila_livekit/` + a
> step-by-step `docs/LIVEKIT_SETUP.md`. See `docs/completed/PHASE_13_COMPLETE.md`.
>
> **17.1 update (2026-06-30):** LiveKit is now **admin-managed** (like the PSP + AI rails), not env vars.
> The super-admin configures it in `/admin/integrations` with a **Demo (self-host) / Live (Cloud)** mode
> toggle, ws URL + key + secret (encrypted at rest), and a **Test connection** (lists rooms to validate auth +
> reachability). Seeded in Demo mode with the local Docker dev keys; the token endpoint hands the client the
> configured ws URL, so switching Demo↔Live is a console change with no redeploy.

- [x] **Self-hosted LiveKit; server-side token minting; pre-join + room (2026-06-29).** `phila_livekit/`
  docker-compose runs the open-source `livekit/livekit-server`; `lib/video/livekit.ts` mints room-scoped JWTs;
  `app/room/[appointmentId]` + `components/video/video-session.tsx` are the waiting room + call. Verified by a
  real-call E2E (fake media) + token unit tests.
- [x] **No audio retention by default (2026-06-29).** LiveKit records nothing without egress configured 
  recording is a future explicit opt-in with consent.
- [x] **Paste-link fallback (2026-06-29).** Settings → Video lets an org choose **Phila video** or **their own
  link** (Zoom/Meet/Teams). `org_video_settings` (mode + url, RLS'd); `resolveVideoJoinUrl` + the `/room` page
  show the org's link when mode = external (falls back to LiveKit if none set). Proven by integration tests.
- [ ] **Production hardening:** self-host in an SA region with TLS (`wss://`) + strong keys (config-only, no app
  change  see `docs/LIVEKIT_SETUP.md`).

---

## 🤖 PHASE 14: AI SCRIBE (POPIA-AWARE)  THE DIFFERENTIATOR ENGINE ✅
*Goal: the scribe that drafts the note AND extracts the funder fields  the fusion. Dormant by default.*

> **✅ COMPLETE (2026-06-30).** A real, dormant-by-default AI scribe over **OpenAI or Claude** (super-admin
> picks + switches one on in `/admin/ai`; keys encrypted). The org's toggle is the **POPIA cross-border consent
> gate**; cues are **de-identified** before any call; the model returns a draft note + structured M&E fields;
> the counsellor edits + signs. Per-org spend cap + metering. Also drafts the client-facing care plan.
> 93 unit/integration green. See `docs/completed/PHASE_14_COMPLETE.md`.

- [x] **Platform provider rail + per-org gate + cap + metering (2026-06-30).** `ai_providers` (super-admin
  configures OpenAI/Claude, one active, encrypted keys); `org_ai_settings` (the consent toggle + monthly cap);
  `ai_usage` (token/cost ledger). The scribe is dormant until both the platform provider AND the org toggle are on.
- [x] **Draft + structured M&E extraction (2026-06-30).** `lib/ai/scribe.ts`: from the counsellor's note cues →
  a professional, non-diagnostic draft + `{presentingIssue, risk, outcome, referral}` (the fields that feed
  Phase 16 reporting  zero double entry). *(STT/Whisper for live audio is a future add; the text-cues pipeline
  is the real path today.)*
- [x] **De-identify before any cross-border call (2026-06-30).** `lib/ai/deidentify.ts` strips names + SA ID /
  phone / email before the prompt; the model writes about "the client"; only the signed note + structured fields
  persist (no raw transcript stored). Unit-tested.
- [x] **AI-honesty (2026-06-30).** Every draft is labelled "AI-generated"; the **counsellor signs** (author of
  record). The AI never signs, sends, or advances clinical state.
- [x] **Client-facing care-plan draft (2026-06-30).** "Draft with AI" in the share panel writes a warm,
  plain-language summary  separate from the private note, edited + shared by the counsellor, never auto-sent.
- [x] **Audit + cost gate (2026-06-30).** Every AI action audited; an honest "budget used up  raise the cap"
  block at the monthly cap.

---

## 💳 PHASE 15: PAYMENTS  PLATFORM BILLING + ORG GATEWAYS ✅ (2026-06-30)
*Goal: two distinct money flows, real. (A) orgs pay Phila; (B) clients pay their org.*

### Task 15A: Platform subscription billing (orgs → Phila) ✅
- [x] **Subscribe + pay Phila (2026-06-30).** Orgs pick a plan on `/hub/billing/plan` and pay Phila via the
  **platform gateway** (Paystack, admin-configured in `/admin/integrations`  encrypted, **Test connection**,
  switch on; never an env var). A paid charge **activates the subscription idempotently** (`subscriptions`
  table; settle keyed on the payment ref) and sets the next period. `getOrgSubscription`/`listPlans` now read
  real subscription rows; super-admin MRR/subscriber counts come from them. Masizakhe's subscription is **seeded**
  (Community, active). Plan catalogue in `lib/billing/plans.ts`. *Trials / proration / dunning / receipts are
  noted as follow-ups; the core subscribe-and-pay loop is real.*

### Task 15B: Org payments  BYO gateway (clients → org) ✅
- [x] **Org's own gateway + client invoice payments (2026-06-30).** Each org connects its **own** Paystack in
  Settings → Payments (paste key → **Test connection** → switch on; encrypted at rest; Stitch/Ozow/Yoco shown as
  "soon"). Every unpaid invoice gets a **signed, unguessable pay-link** ("Pay link" copies it); the client opens
  the **public `/pay/[token]`** page, pays on Paystack through the **org's** key so **funds settle to the org**,
  and the invoice is **marked paid idempotently** (webhook routes by payment ref → org key; the redirect-callback
  is the backstop). If the org hasn't switched payments on, the pay page shows an **honest EFT fallback**. Paid /
  unpaid tracking flows through the existing board. *PSP orchestrator currently = Paystack; income prediction is a
  Phase-16 reporting follow-up.*

### Task 15.1: Phila credit purchase (orgs buy SMS/Email credits → Phila) ✅
- [x] **Self-serve credit purchase + usage dashboard (2026-06-30).** A beautiful **Billing & usage** page
  (`/hub/billing`): SMS + email balances with low-credit warnings, **AI spend vs cap** (progress bar), recent
  message activity, **credit packs** (Buy → Paystack checkout), and a top-up history. A successful payment posts
  a `purchase` to the `credit_ledger` and tops up `credit_balances` **idempotently on the payment ref** (webhook
  + redirect-callback both settle, never double-counts). **Low-balance nudges** show on the billing page **and
  the hub overview** ("top up so messages keep going out"). `payments` table (migration 0017, RLS'd); Paystack
  (`lib/payments/paystack.ts`) dormant until `PHILA_PAYSTACK_SECRET` set. Replaces the Phase-12 manual grant
  (still available as a super-admin fallback). Proven by an idempotency integration test.

> **Phase 15 complete (2026-06-30):** all three flows are real  15A platform subscription billing (orgs → Phila),
> 15B org BYO-gateway invoice payments (clients → org), and 15.1 self-serve credit purchase, all on the shared PSP +
> `payments` table. **Follow-ups (not blockers):** trials / proration / dunning / receipts; an income-prediction
> reporting tie-in (Phase 16); a PSP orchestrator beyond Paystack (Stitch / Ozow / Yoco shown as "soon").

**Done when:** an org subscribes to Phila (A), connects its own gateway in one switch (B), a client pays an invoice that settles to the org, and an org can **buy notification credits** that top up their balance automatically (15.1).

---

## 📊 PHASE 16: ANALYTICS & FUNDER / M&E REPORTING + FUNDER PORTAL ✅ (2026-06-30)
*Goal: the reporting differentiator, **real (DB-backed, no mock)**  computed from the actual clinical work, honest, k-anon-safe  with richer insights and the live funder portal.*

> **Refined plan (2026-06-30):** the analytics surfaces were mock-only. Phase 16 makes them
> **real** by extracting the computation into pure domain functions (`lib/domain/reporting.ts`)
> fed by **DB rows**, then overriding `getReporting` / `getHubInsights` / `getGrantView` /
> `listFunderGrants` / `getFunderGrantView` / `listGrants` / `listFunders` in `db-provider`. Same
> pass adds the **richer insights** the surfaces were missing.

- [x] **Real DB analytics layer (2026-06-30)**  `lib/domain/reporting.ts` pure functions + `db/queries/analytics.ts`
  + `db/queries/grants.ts` row loaders feed the Hub `<StatCard>`s + charts. **`getReporting` / `getHubInsights` /
  `getGrantView` / `getFunderGrantView` / `listGrants` overridden in `db-provider`  no mock fallback.**
- [x] Consent-gated demographic dashboards (province / gender / age / status / service); **k-anonymity
  floor + small-cell suppression** on every aggregate/funder export; coverage on every figure. A **richer cohort
  is seeded** (39 consented clients) so cells are meaningful and suppression is demonstrable.
- [x] **Richer insights**  Insights now shows **period-over-period trend chips** (completed, attendance,
  new clients, revenue vs the previous window); Reporting shows **improvement rate** + a server-computed
  **key-findings headline**; each grant dashboard carries an **at-a-glance** status line.
- [x] **Grant-indicator engine (DB):** each indicator's **actual vs target** from `grant_allocations` +
  clinical data per its rule (de-dup via distinct allocation), **paced expected** marker, on-track / at-risk /
  behind classification.
- [x] Outcome-measure analytics  PHQ-9 trend (real `taken_at` → week buckets) + **improvement rate** (first→latest ≥5).
- [x] **Funder portal wired** (`/funder`): provider-enforced grant scoping (a funder reaches only their grant);
  every funder view **k-anon + audited**; **narrative updates persist** (`grant_narratives`) and appear on the portal.
- [x] One-click funder report (**CSV** download, PDF via print), audit-logged (`pii.export`), role-gated.

---

## 🌐 PHASE 17: ORG PUBLIC PAGE REAL + SEO ✅ (2026-06-30)
*Goal: org-editable, SEO-ranking public micro-sites, wired  world-class and fully DB-backed (no mock).*

> **Refined plan (2026-06-30):** a real `org_public_pages` table (seeded), a **section-based
> editor** where the org manages each block (hero, about, services, team, FAQ, contact, CTA)
> with show/hide + reorder-free clean defaults, a **beautiful public micro-site** rendered from
> that data, full **SEO** (per-org metadata + OG + JSON-LD + sitemap + robots), and **booking
> wired through** with PII-free conversion analytics.

- [x] **`org_public_pages` table (seeded, no mock)  2026-06-30.** Section model (hero, about, approach,
  services, team, FAQ, contact)  each with its own copy + a show/hide toggle. `db-provider.getOrgPublicPage`
  overridden to read it (services/team/sites from the real tables). Masizakhe seeded with rich content.
- [x] **World-class public micro-site** at `/o/[slug]` (SSG + `revalidate: 3600`): brand-tinted hero with
  the org's headline + voice, POPIA badge, approach cards, services with real durations/prices, team with
  verified credentials, native-accordion FAQ, contact (tap-to-call/email) + locations, a final CTA band.
  Light + dark, mobile-first, honest non-diagnostic copy, org brand-accent (auto-AA).
- [x] **Section editor in the Hub**  manage each section's content + visibility (eye toggles), add/remove
  approach + FAQ items, SEO fields, a sticky Save; **persisted** + the live page **revalidated** on save.
- [x] **SEO**: per-org `generateMetadata` (custom title/description/canonical/OG/Twitter) + **JSON-LD**
  (`MedicalBusiness` + `Service` + FAQ `Question`s) + dynamic **app/sitemap.ts** (every org) + **app/robots.ts**
  (public `/o/` indexable; app/hub/admin/funder/api disallowed).
- [x] **Booking wired** from the public page (deep-linked `?service=`) → the booking flow; **PII-free
  funnel** (`public_page_events`: view via beacon, book_click + booked server-side) with views / clicks /
  bookings / **conversion %** shown in the editor.
- [ ] Custom domains per org  **deferred** (documented extension).

---

## 📁 PHASE 18: DOCUMENT SYSTEM  HUB-FIRST, SUPABASE-BACKED
*Goal: a beautiful, smooth document workspace for the org  folders, drag-to-move, assign-to-client,
request-gated client uploads, and org→counsellor sharing  all on Phila Storage (Supabase), POPIA-safe.*

> **Full plan: `docs/PHASE_18_PLAN.md`.** Real file storage was always staged to land "with the documents
> feature" (Phase 10 closeout)  this is that feature. **Phila Storage only** (Supabase now; S3 later behind the
> same `StorageProvider` seam, no interface change); **Google Drive dropped**  clinical special-category PII
> never leaves Phila's controlled, in-region store. Three honest **access lanes**: the **org owns + organises**,
> a **counsellor sees own-clients + what's shared to them**, a **client sees only what's assigned + uploads only
> against a request**. Documents are *shared* artifacts and remain distinct from the private `session_notes`
> (Rule #1); a per-document **visibility** flag keeps finance/front-desk out of clinical files.

> **Progress (2026-06-30):** **18.1 foundations** ✅ (commit `0b9395e`) and **18.2 the Hub document manager** ✅
> are shipped and green (tsc/lint/build + 105 tests). The manager is live at `/hub/documents`, built **UI-first
> on the seam**  folders, drag-to-move, multi-select, smart views, assign/share/request all persist + audit.
> **Next:** the Supabase `StorageProvider` + presigned uploads + scan gate + the admin "Phila Storage" card
> (makes the dormant Upload real), then the client side (request-bound upload + signed download).

### Task 18.1: Foundations  schema, storage seam, safety
- [x] **Schema + RLS + seed (2026-06-30, `0b9395e`).** `document_folders` (org-scoped tree via `parent_id`), a
  generalized `documents` (storage_provider/key, content_type, bytes (bigint), folder_id, client_id?,
  counsellor_id?, session_id?, visibility, scan_status, uploaded_by, soft-delete), `document_requests`,
  `document_shares`, `org_storage_usage`  all RLS'd + seeded; migration 0021 applied; legacy `client_documents`
  backfilled into `documents`.
- [x] **StorageProvider seam + Supabase backend (2026-06-30):** `lib/storage/*`  Supabase over REST (presigned
  upload, short-TTL signed download, delete, test-connection); private bucket + service-role server-only; resolved
  from encrypted `platform_integrations` config, **dormant until switched on**. The **admin "Phila Storage" card**
  (configure → Test → switch) is in `/admin/integrations`. **Uploads are real:** the manager's Upload button +
  drag-to-upload do `requestUpload` → **presigned PUT straight to Supabase** → `confirmUpload`; downloads are
  short-TTL signed URLs (clean files only), audited. S3 is a later drop-in behind the same interface.
- [~] Upload safety: **content-type allowlist + size cap + per-plan quota enforced server-side (2026-06-30)**;
  a `scan_status: pending → clean | quarantined` **gate** with a swappable scanner hook (`lib/documents/scan.ts`;
  not downloadable until clean). *(Real AV scanner + **magic-byte sniff** + per-user rate limit are the documented
  follow-ups.)* Every action audited.
- [x] **Per-plan storage quota (2026-06-30):** an honest hard cap on upload (`storageLimitBytes`; never a silent
  fail), a live usage meter in the manager. *(Plan `storageGb` entitlement + buy-more top-up are the follow-up.)*

### Task 18.2: The Hub document manager (the beautiful part)
- [x] **Two-pane workspace (2026-06-30):** folder **tree** + file **grid/list**, breadcrumbs, **drag-to-move**
  (drop-target glow + optimistic + reconciled), multi-select **floating action bar**, inline rename. Motion
  GPU-cheap + reduced-motion aware; 360px-first; light/dark. *(drag-to-**upload** + search land with the storage slice.)*
- [x] **Smart views (2026-06-30):** All documents · **Needs review** (client uploads, badged) · By client 
  computed from the row fields; real folders + smart views side by side.
- [x] **Assign to client** (set `client_id`) and **Share file/folder with a counsellor** (`document_shares`)
  (2026-06-30)  plus a **Request a document** action; all via Zod + audited + org-scoped server actions.
- [x] **Counsellor lane (2026-06-30):** `/app/documents`  the counsellor sees **their own clients' files**
  (grouped by client) **+ "Shared with you"** (`listCounsellorDocuments`: own-clients ∪ `document_shares`),
  read-only with signed-URL download (clean files only), audited. *(Dossier Documents-card going live is a follow-up.)*

### Task 18.3: Requests + notifications
- [x] **Document requests (2026-06-30):** the Hub creates a request (`requestDocument`); the client portal's
  "Requested from you" shows it and uploads **against** it (no unsolicited uploads); fulfilment flips the status
  `pending → fulfilled` and links the document. *(A request-from-the-dossier shortcut is a small follow-up.)*
- [x] **Phase-12 channel triggers (2026-06-30):** `document_shared` (org → client, on assign-to-client) and
  `client_uploaded_document` (→ the practice email, on a client fulfilling a request)  both routed through the
  Phase-12 `deliver` chokepoint (consent / opt-out / quiet-hours / credits honoured; dormant channels never fake a
  send), both **hub-editable** in the template manager. *(A richer in-app notification feed is a follow-up; the
  Hub's "Needs review" view already surfaces client uploads.)*

### Task 18.4: Client side, made real
- [x] **`/me/documents` (2026-06-30):** a **"Requested from you"** section (the client uploads **only** against an
  open request  no unsolicited uploads), with the real presigned upload flow; **"Your documents"** shows
  client-visible files with a real **signed-URL download**; the old optimistic-only upload button is gone. Reads
  are the new client-scoped provider methods (`listClientVisibleDocuments` / `listClientDocumentRequests`); every
  access audited. *(Counsellor "shared-with-me" lane + dossier integration + delivery notifications still to come.)*

**Done when:** the Hub organises documents in folders and moves/assigns them smoothly; a counsellor sees their
clients' docs + anything shared to them; a client uploads only what was requested and opens only what was shared;
every file rests in Phila's private Supabase bucket  scanned, quota-capped, signed-URL-only, and fully audited.

---

## 💬 PHASE 18.5: TEAM MESSAGING  REAL-TIME STAFF CHAT ✅ (2026-07-01)
*Goal: make the internal staff chat real, add group conversations, and light it up with **live delivery +
presence**  world-class (push), not polling.*

> Was 100% mock (the send only logged; threads came from fixtures). Now **Neon is the source of truth** with
> **Supabase Realtime** for live delivery + presence  reusing the Phila Storage · Supabase integration (url +
> service-role + **anon key**). The chat is **Dormant-by-Default**: without the anon key it falls back to
> load-on-refresh; nothing is ever lost (messages persist regardless of the socket).

- [x] **Real persistence (2026-07-01):** `message_threads` · `thread_members` (+ read cursor for unread) ·
  `team_messages` · `user_presence` (migration 0022, RLS on the three org-scoped tables, seeded from the fixture
  threads). `db/queries/messages.ts`  list threads (messages + unread + names/roles), send (find-or-create the 1:1
  thread), mark-read. Provider `listTeamThreads(userId, orgId)` DB-backed; `sendTeamMessage` persists; `markThreadRead`.
- [x] **Group chat (2026-07-01):** create a named group + invite teammates (`createGroup`), group threads with a
  member count + group avatar, **per-message sender names**; unified send (by `threadId` for a group/existing
  thread, or by `toUserId` for a new 1:1).
- [x] **Supabase Realtime  live + presence (2026-07-01):** `lib/messaging/realtime.ts` broadcasts each new message
  to its **per-thread channel** (keyed by the unguessable `mt_<uuid>` id) on send; the client subscribes via
  `@supabase/supabase-js` for **instant delivery** (dedup + unread bump; own messages skipped) and joins an **org
  Presence channel** for real **online dots** + "Active now"; smooth **auto-scroll**. The super-admin pastes the
  Supabase **anon (public) key** in Admin → Integrations → Phila Storage.
- [x] **Follow-ups shipped (2026-07-01):** a live **"you were added to a group"** push (new members get the group
  on the fly, no reload); **typing indicators** (client→client via the thread channel; "…is typing" in the header);
  **message edit + delete** (author-only, live in-place, with an "· edited" marker + a "This message was deleted" state).
- [x] **Attachments (2026-07-01):** a paperclip in the composer → presigned upload to **Phila Storage** (validates
  type + size + the org quota) → the message carries the file; an attachment chip (name + size + open via short-TTL
  signed URL, members-only, audited). **Attachment bytes count against the org's storage** (`org_storage_usage`).
- [x] **Private channels + Supabase RLS (2026-07-01, opt-in):** the server mints a short-lived Supabase-compatible
  JWT scoped to the user's channels (a `topics` claim), the client uses **private channels** + that token when the
  super-admin switches it on (with the JWT secret + the one-time RLS SQL in `docs/SUPABASE_REALTIME_SETUP.md`); the
  token refreshes as threads change. **Off by default** (public per-thread channels keyed by the unguessable
  `mt_<uuid>` id remain the fallback). **Phase 18.5 fully done.**

**Done when:** staff chat persists, groups work, and messages + presence are live across sessions  proven with two
roles side-by-side. ✅ **Met** (tsc/lint/build + 119 tests green throughout the four commits).

### Platform refinements (same pass, 2026-06-30 → 07-01)
- **Admin Integrations console reworked:** **tabs** (Phila platform vs Org connections), beautiful summary cards +
  **per-integration config pages** (`/admin/integrations/[slug]`, back-linked), and **SMS · BulkSMS + Email · Resend**
  added as **admin-managed** system integrations (were env-only; transports read DB creds first, fall back to env).
  Fixed the catalogue mislabel (SMS "Clickatell" → **BulkSMS**).
- **Landing pricing switch:** a super-admin toggle (Plans & billing) shows/hides the pricing tiers on the public
  landing  **default hidden** while pricing is finalised; a new marketing **Pricing** section reads `lib/billing/plans.ts`.
- **`/marketing` conversion funnel (2026-07-01):** a copy-led 10-section funnel (Hero → Problem → Who → What changes
  → How it works → Proof → Why → Pricing → Final CTA → Footer) in `components/marketing/funnel.tsx` +
  `app/marketing/page.tsx` (SSG+ISR, SEO, reuses `SiteNav`/`ClosingCta`/`SiteFooter`; pricing gated by the same
  `landing_pricing` switch, else a `PricingTeaser`); added to `app/sitemap.ts`. The editable **copy-of-record** lives
  in `docs/marketing_page/MARKETING_PAGE_COPY.md` (honours the rules: no competitor names, no fabricated
  stats/testimonials, no medical-aid claims, prices from the `plans` table). `/` stays the visual product-led landing;
  `/marketing` is the copy-led funnel.
- **Global dialog fix:** the single-character-defocus bug in **every** dialog (the focus effect depended on a fresh
  `onClose` each render, refocusing the panel on every keystroke).

---

## 🔒 PHASE 19: TRUST, SECURITY & POPIA HARDENING
*Goal: be allowed in the room with the most sensitive data there is.*
- [ ] **Data residency:** migrate Postgres to an SA region (AWS `af-south-1` / Azure SA North) on the `db/client.ts` swap; confirm storage + AI inference residency posture; document cross-border flows.
- [ ] Field-level encryption live; security headers; rate limiting (Upstash) on auth/booking/AI/messaging; observability skeleton.
- [ ] **DPIA**; data-subject tools (export / erasure) wired to real soft-delete + pruner cron; retention policy + breach log.
- [ ] **Opt-out / DMA registry** screen before any marketing send (per the SA direct-marketing registry; manual suppression-list import until the API is published); block + audit if registered.
- [ ] One-click **POPIA pack** per org (consent records + lawful-basis evidence + audit + retention + breach log)  "compliance you can show the Information Regulator."

---

## 🧪 PHASE 20: TESTING & QA
*Goal: prove the invariants that matter  isolation, redaction, consent, safeguarding.*
- [ ] Unit (scheduling, freshness, k-anon, contrast, consent state machine).
- [ ] Integration (Server Actions + Zod + RLS on a real-Postgres harness).
- [ ] E2E (Playwright) across all roles at 1280px + 360px.
- [ ] **Compliance tests:** no PII in public/cross-org payloads; **RLS cross-org isolation**; notes never leak; demographic export respects consent + k-anon; **funder is scoped to its grants + sees only k-anon aggregates + small cells suppressed + every view audited** (no identifiable client reachable as a funder); "AI-generated" labelling present; safeguarding never auto-actions.

---

## 🚀 PHASE 21: LAUNCH READINESS
*Goal: a real first org live (the warm org), priced, onboarded, deployed.*
- [ ] Plans + entitlements finalised in the `plans` table; pricing framing leads with **total cost** + **POPIA-in-SA** as the wedge; AI tier priced for the metered cost.
- [ ] **Industry-in-a-box onboarding:** pick "NGO counselling" / "EAP" / "private practice" → services + intake + consent purposes + report templates preconfigure.
- [ ] Naming/brand pass (the working name → final, with .co.za + trademark + HPCSA-confusability checks).
- [ ] Deployment checklist (below) executed; the warm org onboarded as design partner.

---
---

## 🌱 ADVISED ENHANCEMENTS (backlog  tag `[new]` / `[phase N]`)
- [ ] **Group / couple / family sessions** `[new]`  multi-client appointments + notes.
- [ ] **Waitlist auto-fill** `[phase 11]`  a cancelled slot offers itself to a waitlisted client via WhatsApp.
- [ ] **Sliding-scale / subsidised fees** `[phase 15]`  per-client fee rules (NGO reality).
- [ ] *(Promoted to core  PWA + offline send-queue now ship in Phases 0/8/11.)* Remaining backlog: **low-data media-defer toggle** refinements for field counsellors on metered data.
- [ ] **Low-data media-defer toggle** `[phase 8]`  finer control for field counsellors on metered data (English-only; no translation work  SA, one language).
- [ ] **Supervision analytics** `[phase 16]`  supervisor caseload quality + sign-off turnaround.
- [ ] **Referral network** `[new]`  refer a client to another org/service with consented handover.
- [ ] **Client-facing self-help / between-session check-ins** `[new]`  gentle, opt-in, never a bot pretending to be a counsellor.
- [ ] **Custom domains per org** `[phase 17]`.

---

## 🚀 DEPLOYMENT CHECKLIST
### Pre-launch
- [ ] `DATA_PROVIDER=db`; Neon→SA-region Postgres; RLS verified; backups + PITR.
- [ ] Supabase Storage buckets private; signed-URL-only; service-role server-only.
- [ ] Better Auth secrets; 2FA enforced for admins/supervisors.
- [ ] WhatsApp/email/SMS transports configured + tested; opt-out + quiet hours live.
- [ ] LiveKit self-hosted in-region (or paste-link only); no audio retention.
- [ ] AI rail: platform key set; per-org caps; s.72 acknowledgement; de-identify + ZDR verified; audio discard verified.
- [ ] PSP webhooks + idempotency; **platform subscription billing live**; **org BYO-gateway connect + Test passes**; DPIA signed; Information Officer designated; POPIA pack generates.
- [ ] Light + dark verified; PWA installable + offline send-queue syncs; rooms + utilisation correct; team-role permissions enforced (front_desk/finance can't reach notes).
- [ ] Funder portal scoping verified  a funder reaches only its grant(s), only k-anon aggregates, small cells suppressed, every view audited; report builder exports the funder's template.
- [ ] `test:all` green incl. compliance + RLS isolation; 360px + 1280px E2E.
### Launch
- [ ] Onboard the warm org; seed services/intake/consent; train the Hub admin + counsellors.
- [ ] Public page live + SEO submitted; booking conversion tracked.
### Post-launch
- [ ] Watch AI/WhatsApp spend vs caps; no-show rate; demographic coverage; funder-report usage.
- [ ] Monthly: retention/erasure pruner; suppression-list sync; catalogue/consent-version review.

---

## 📝 APPENDIX: DOMAIN DATA REFERENCE

### Provinces (seed)
Eastern Cape · Free State · Gauteng · KwaZulu-Natal · Limpopo · Mpumalanga · North West · Northern Cape · Western Cape.

### Session/appointment states (`appointment.state`)
`scheduled` · `completed` · `no_show` · `cancelled` · `rescheduled` · `postponed` · `discharged` · `risk_flagged`. (Quiet state-dot mapping: `DESIGN.md` §2.)

### Roles + capability
**Platform:** `super_admin` · `client` · **`funder`** (external, read-only, scoped to its grant(s),
aggregate/k-anon only, audited). **Org team** (`org_members.team_role`): `org_admin` · `counsellor`
(+`is_supervisor`, +`supervisorId` edge, + room schedule) · `front_desk` / `intake_coordinator` ·
`finance` · `programme_manager`. A user may be a member of multiple orgs with a different role in each.

### Funders, grants & M&E
`funders` (type `government|lottery|corporate_csi|foundation|international`) → `grants` (period, amount,
restricted, reporting schedule) → `grant_indicators` (type `count|percentage|outcome_delta|demographic_proportion`,
target, computation rule) ← `grant_allocations` (client/programme ↔ grant). Actuals auto-roll from the
clinical work; everything funder-facing is k-anon + consent-gated (`funder_reporting`) + audited.

### Rooms & resources
`sites` (venues) → `rooms` (name, capacity, equipment, status `active|maintenance`, colour) →
`room_assignments` (counsellor ↔ room ↔ day/time). In-person `appointments` carry a conflict-free
`room_id`; utilisation (meetings, hours, %) is derived per room.

### Care artifacts (the confidentiality distinction)
`session_notes` = **private** clinical note (author + supervisor; Hub access audited). `care_plans` /
`session_summaries` + `care_plan_tasks` = the **client-shared** artifact (advice, tasks, next steps),
shared by an explicit, consented counsellor action  never the private note.

### Enums
`teamRole` (`org_admin|counsellor|front_desk|finance|programme_manager`), `funderType`
(`government|lottery|corporate_csi|foundation|international`), `indicatorType`
(`count|percentage|outcome_delta|demographic_proportion`), `grantStatus` (`pending|active|closed`),
`appointmentType`
(`online|in_person`), `careState`, `credentialStatus` (`unverified|pending|verified|rejected`),
`roomStatus` (`active|maintenance`), `consentPurpose` (`booking|notes|demographics|ai_processing|comms|care_plan_share|funder_reporting`),
`consentState` (`none|granted|revoked`), `paymentProvider` (`stitch|ozow|yoco|paystack`),
`paymentStatus` (`unpaid|paid|cancelled|refunded`), `subscriptionStatus`
(`trialing|active|past_due|cancelled`), `outcomeTool` (`PHQ-9|GAD-7|…`), `aiFeature`
(`note_draft|care_plan_draft|extraction|summary`), `theme` (`system|light|dark`).

### Demographic fields (SPECIAL personal information  consent-gated, purpose-bound, k-anon on export)
`gender` · `race` · `employmentStatus` · `ageBand` · `province`. Captured only with `demographics` consent; never on a public/cross-role payload; excluded from any export cell below the k-anonymity floor (default 5). *These exist for funder/M&E reporting and SA statutory context  never as a clinical judgement.*

### Outcome measures (seed)
`PHQ-9` (depression) · `GAD-7` (anxiety). Extend per org (e.g. WHO-5, K10). Tracked across sessions; honest "not yet measured" state.

### Redaction matrix (what each role sees)
| Field | Client (self) | Counsellor (own clients) | Org admin (Hub) | Super admin |
|-------|---------------|--------------------------|-----------------|-------------|
| Own profile / appointments | ✅ | ✅ | ✅ | aggregate only |
| **Private** case note body | ❌ | ✅ (author + supervisor) | **audited access only** | ❌ |
| **Shared** care plan / summary | ✅ (own) | ✅ (author) | ✅ | ❌ |
| Demographics | ✅ (own) | ✅ if consented | ✅ if consented (reporting) | aggregate only |
| Contact details | ✅ (own) | ✅ (own clients) | ✅ | ❌ |
| ID number | ✅ (own, masked) | masked | masked | ❌ |
| Room schedule / utilisation | ❌ | own assignments | ✅ | aggregate only |
| Cross-org data | ❌ | ❌ | ❌ (RLS) | audited |

> **Org-team nuance:** the "Org admin (Hub)" column is the *ceiling* for the org. `front_desk` sees
> scheduling + rooms + contact but **not** notes/care-plan/demographics; `finance` sees invoices +
> payments but **not** clinical data; `programme_manager` sees aggregate + consented demographics for
> reporting but **not** individual notes. Every note/care-plan access outside the authoring counsellor
> + supervisor is audited.
>
> **Funder (external):** sees **only** aggregate, k-anonymised, consented (`funder_reporting`) figures
> for **its own grant(s)**  indicators vs targets, demographic breakdowns above the k-floor, outcome
> trends, session counts, and org-posted narrative. **Never** an individual client, note, care plan,
> contact, demographic row, or any other grant. Read-only; every view audited.

*Last updated: 2026-06-30 · Version 1.0 · Phila · philasa.com · Stack: Next.js · Neon · Better Auth · Supabase Storage · LiveKit*
