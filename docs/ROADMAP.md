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

**Remaining (small; none change the UI):**
- [ ] **Playwright E2E + axe** sweep (§7).
- [ ] Optional **loading/error mock flag** (§3)  states already drawn (Phase 8).
- [ ] **Closeout ritual** (§8)  `PHASE_A_COMPLETE.md`, `PHASE_9_PLAN.md`, tag the commit.

---
---

# 🟩 PART B  WIRE IT REAL (Phases 9–20)

*Goal of Part B: swap mock → real behind the `dataProvider` seam, light up integrations, harden for
POPIA, test, and launch  **without changing the Part-A UI.***

---

## 🔐 PHASE 9: IDENTITY, AUTH & CONSENT
*Goal: real accounts, all roles, multi-tenant sessions, and lawful consent.*

### Task 9.0: Auth + onboarding UI shells (Part A, 2026-06-28)
- [x] **Beautiful auth surface, mock-first** (real auth lands in 9.1–9.2 behind these exact screens). A warm branded **`AuthShell`** (gradient brand panel + POPIA/data-in-SA/private-notes trust signals on desktop; slim header, single-column on mobile). **`/login`** (email + password with **show/hide eye**, forgot-password link, "explore a demo workspace" quick-access), **`/signup`** (practice registration  name, your name, work email, **password strength meter**, province, POPIA agree → onboarding), **`/forgot-password`** + **`/reset-password`** with calm success states. Marketing CTAs now route to **Sign in / Get started**. The Security card password fields (Hub/counsellor/client) upgraded to the same eye-toggle + strength + **"passwords match"** indicator.
- [x] **Onboarding wizard** (`/onboarding`): a 4-step flow  practice basics → working hours → **verification documents** → done  with a progress bar, smooth steps, Skip, and a celebratory finish → the Hub. `completeOnboarding` (mock).
- [x] **Platform-controlled onboarding requirements** (your call): the **super admin** configures the **documents every new practice must upload** at `/admin/onboarding` (toggle required/optional, add/remove; `saveOnboardingRequirements`, audited). The onboarding wizard **reads that exact checklist** (`listOnboardingRequirements`) for its upload step  so the platform owns the verification gate, and the practice (Hub) uploads to satisfy it.
- [x] **Document review (2026-06-28):** the admin org detail (`/admin/orgs/[id]`) shows each practice's uploads with status (verified · awaiting review · sent back · not uploaded), filename + age, and **Verify / Send-back** actions (`reviewOnboardingDoc`, audited). An overall **verification badge** (Verified / Pending / Action needed) rolls up and gates payouts + funder sharing. `getOrgOnboardingReview` merges requirements with per-org submissions.
- [x] **Client invite + activation (2026-06-28):** the Hub can **Invite a client to their portal** from the client page  over **WhatsApp / SMS** (their number) or **email**, offering only the channels the org has enabled *and* has details for (`inviteClientToPortal`, audited). The client taps the link → **`/activate`** (set a password → their `/me` space). The **auto-register-at-booking** path is wired too: the public booking success now says "your private space is ready" with a **Set up your account** CTA into the same activation page.
- [x] **Team invite + activation (2026-06-28):** the Hub invites a counsellor / team member from `/hub/team` (Invite member) and can **(re)send a setup link** from the member page (`sendSetupLink`, audited). **`/activate` is now role-aware**  a team invite (`?role=counsellor|org_admin`) reads "Welcome to the team · access your workspace" and lands them in **/app** or **/hub**; a client invite keeps the warm portal copy and lands in **/me**. One activation page, the right destination per role.

### Task 9.1: Better Auth setup
- [ ] Better Auth + Drizzle adapter; email+password + verification + forgot/reset; sessions in Postgres.
- [ ] Role model  **platform** (`super_admin | client | funder`) + **org team_role** (`org_admin | counsellor | front_desk | finance | programme_manager`, +`supervisor`); Server-Action sign-in routes by role; multi-org membership resolution + org switcher.
- [ ] Route-group guards via proxy: `requireRole` / `requireOrg` / `requireOrgFeature` / **`requireFunderGrant`** (scopes a funder to their grant(s) only, read-only) on `(app)` / `(hub)` / `(admin)` / `(me)` / `(funder)`.
- [ ] 2FA (TOTP) for `super_admin` + `org_admin` + supervising counsellors.

### Task 9.2: Sign-up + consent persistence
- [ ] Client sign-up (lightweight, from booking) · counsellor + team (org-invited) · org_admin (org-created) · **funder (org-invited, scoped to grant(s), read-only)** · super_admin (issued, not self-registered).
- [ ] Consent state machine persisted (`consents`: purpose + version + timestamp); booking/notes/demographics/AI/comms/care-plan-share/**funder_reporting** each independently granted/revoked; audit-logged.
- [ ] Audit-log persistence (`audit_log` table); `/admin/audit` + Hub note-access reads from it.

**Done when:** real auth + consent back the Part-A UIs unchanged; every PII read writes an audit row.

---

## ⚙️ PHASE 10: THE DATA ENGINE  SCHEMA + RLS + QUERIES + STORAGE
*Goal: the schema, tenant isolation, and integrity everything stands on. The mock→db swap.*

### Task 10.1: Drizzle schema
- [ ] Tenancy: `orgs`, `org_members` (**+ `team_role`**: org_admin / counsellor / front_desk / finance / programme_manager, + `is_supervisor`), `app_users`. Care: `counsellors` (credential, supervisor edge), `clients`, `appointments`, `sessions`, `session_notes`, `recurring_series`, `services`, `intake_forms`, `intake_responses`.
- [ ] **Rooms:** `sites` (venues), `rooms` (name, site, capacity, equipment, status, colour), `room_assignments` (counsellor ↔ room ↔ day-of-week/date ↔ start/end  the schedule), and `appointments.room_id` (in-person). Utilisation is derived.
- [ ] **Client-shared care:** `care_plans` / `session_summaries` (the shared artifact, distinct from `session_notes`) + `care_plan_tasks` (between-session tasks with done state). Sharing is an explicit, consented action; the private note is never exposed.
- [ ] **Funders & grants (M&E):** `funders` (name, type, contacts), `funder_contacts` (user ↔ funder, scoped to grants), `grants` (funder, org, period, amount, restricted, reporting schedule, status), `grant_indicators` (name, type `count|percentage|outcome_delta|demographic_proportion`, target, computation rule), `grant_allocations` (client/programme ↔ grant), `grant_narratives`, `grant_reports`.
- [ ] Sensitive: `demographics` (special personal info), `outcome_measures`, `risk_flags`. POPIA: `consents`, `audit_log`.
- [ ] **Payments (two layers):** `subscriptions` (org ↔ Phila plan  platform billing) and `payment_connections` (org's BYO gateway: provider + **encrypted credentials** + status) + `invoices` + `payments`. Comms: `notifications`, `message_templates`. AI: `ai_jobs`, `usage_events`, `ai_providers`. Public: `org_public_pages`.
- [ ] Enums per Appendix. Indices: btree on `org_id` + FKs + `room_assignments(room_id, day)`; GIN where searched.

### Task 10.2: Row-Level Security (the real isolation boundary)
- [ ] RLS policies on **every** `org_id` table keyed off the authenticated org + role. `super_admin` cross-org access via an explicit, audited path. Tests assert no cross-org leak (Phase 19).

### Task 10.3: The real `dataProvider` + integrity
- [ ] `dbProvider` matching the mock interface (`DESIGN.md` §11) **exactly** → UI unchanged.
- [ ] Typed query fns in `db/queries/*` (no raw queries in components); Server Actions + Zod on every mutation; `logAccess()` on every PII path.
- [ ] **Select-list redaction:** `session_notes.body`, contact, `national_id_enc`, demographics never selected on a shared/cross-role path.
- [ ] Supabase Storage (private buckets, signed URLs, service-role server-only) for documents / uploads / generated reports; magic-byte sniff + size limits + per-user rate limit; every file access audited.

**Done when:** `DATA_PROVIDER=db` runs the whole product on Neon with RLS enforced and no UI churn.

---

## 🗓️ PHASE 11: SCHEDULING ENGINE
*Goal: real availability, rooms, room-assignments, and recurring series behind the Part-A calendar.*
- [ ] Business-hours / buffer / break engine; `availableSlots(org, counsellor, date)` real impl mirroring the mock helper.
- [ ] **Room allocation:** in-person bookings require a room; default from the counsellor's `room_assignments` (day/time), validate the room is free, **prevent double-booking** a room or a counsellor; multi-site aware.
- [ ] Room utilisation rollups for the Hub (`/hub/rooms`): meetings, booked hours, % utilisation, busiest day.
- [ ] Recurring-series generation + edit-this/all; reschedule + cancel with reason; care-state transitions.
- [ ] **Offline send-queue (PWA):** queued bookings/reschedules sync on reconnect with conflict re-check; the queued-state UI from Phase 8 goes live.
- [ ] Calendar + booking + Hub oversight now read real availability.

---

## 💬 PHASE 12: NOTIFICATIONS (WHATSAPP + EMAIL + SMS)
*Goal: instant, honest booking/cancel/reschedule/reminder notifications  WhatsApp-first.*
- [ ] Env-driven transport adapter: WhatsApp (Meta Cloud API / 360dialog / Clickatell) + Resend email + optional SMS. Dormant until configured.
- [ ] Triggers: booked / rescheduled / cancelled / reminder (T-24h, T-1h) / no-show follow-up. 24h-window awareness for WhatsApp; approved templates outside it.
- [ ] **Opt-out + quiet hours** always win; honest delivery states (no fake "sent"); **metered + capped** (Cost Rule); audited.

---

## 🎥 PHASE 13: VIDEO (LIVEKIT) + PASTE-LINK FALLBACK
*Goal: real online sessions, owned and in-region, or the org's own link.*
- [ ] Self-hosted LiveKit (SA region); server-side token minting; pre-join + room wired into the Part-A shell.
- [ ] **No audio retention** by default; recording only if an org explicitly enables it with consent.
- [ ] **Paste-link fallback** when org `videoEnabled=false` (org pastes Zoom/Meet/Teams); admin toggle in the switchboard.

---

## 🤖 PHASE 14: AI SCRIBE (POPIA-AWARE)  THE DIFFERENTIATOR ENGINE
*Goal: the scribe that drafts the note AND extracts the funder fields  the fusion. Dormant by default.*
- [ ] Platform-keyed provider rail (Phase 6) goes live; per-org **toggle = POPIA cross-border consent gate**; per-org entitlement + spend cap + metering.
- [ ] Pipeline: session audio → STT (**self-hosted Whisper in-region**, or a ZDR provider) → note **draft** + **structured M&E extraction** (presenting issue, risk flags, demographics-if-consented, outcome, referral).
- [ ] **De-identify before any cross-border call**; **ZDR** provider; **audio + raw transcript discarded** after the note; only the signed note + structured fields persist.
- [ ] Every draft labelled "AI-generated"; the counsellor **signs** (author of record); the structured fields feed Phase 16 reporting (zero double entry).
- [ ] The AI can also draft the **client-facing care plan / summary** (Task 4.3)  separate from the private note, plain-language, labelled, **edited and shared by the counsellor**, never auto-sent.
- [ ] Audit every AI action; honest cost nudge at the cap.

---

## 💳 PHASE 15: PAYMENTS  PLATFORM BILLING + ORG GATEWAYS
*Goal: two distinct money flows, real. (A) orgs pay Phila; (B) clients pay their org.*

### Task 15A: Platform subscription billing (orgs → Phila)
- [ ] Orgs subscribe to a plan and pay Phila via Phila's own PSP; trials, upgrade/downgrade, proration, dunning, receipts; entitlements enforced from the `plans` table; super-admin billing views.

### Task 15B: Org payments  BYO gateway (clients → org)
- [ ] Each org connects its **own** gateway (the provider it switched on + credentials it entered in Task 5.5), stored encrypted; a **PSP orchestrator** abstracts Stitch / Ozow (PayShap + pay-by-bank) + Yoco / Paystack (cards) behind one interface so switching providers is a toggle.
- [ ] Invoices (from the A4 builder) charge through the **org's** connected gateway → funds settle to the org; webhooks + idempotency keys (load-shedding-safe); paid / unpaid / cancelled / refunded tracking; income + **income prediction** from real data; metered where Phila fronts a cost.

**Done when:** an org subscribes to Phila (A), connects its own gateway in one switch (B), and a client pays an invoice that settles to the org.

---

## 📊 PHASE 16: ANALYTICS & FUNDER / M&E REPORTING + FUNDER PORTAL
*Goal: the reporting differentiator, real  built from the clinical work, honest, k-anon-safe  and the live funder portal.*
- [ ] Aggregation layer / scheduled rollups (PII-free) for the Hub `<StatCard>`s + charts.
- [ ] Consent-gated demographic dashboards (province / gender / age / status / service); **k-anonymity floor + small-cell suppression** on any aggregate/funder export; coverage shown on every figure.
- [ ] **Grant-indicator engine:** compute each indicator's **actual vs target** from `grant_allocations` + the clinical data per its computation rule (honest de-dup across grants); on-track/at-risk/behind classification.
- [ ] Outcome-measure analytics (PHQ-9/GAD-7 trends, fed by Phase 14 extraction + manual capture).
- [ ] **Funder portal wired** (`/funder`): `requireFunderGrant` scoping; every funder view k-anon + audited; the org controls visibility; narrative updates + downloadable period reports.
- [ ] One-click funder report (CSV/PDF/template), audit-logged, role-gated; suppression-list reuse from Phase 18.

---

## 🌐 PHASE 17: ORG PUBLIC PAGE REAL + SEO
*Goal: org-editable, SEO-ranking public micro-sites, wired.*
- [ ] Public page + editor wired to `org_public_pages`; SSR/ISR; per-org `generateMetadata` + OG + JSON-LD; per-org sitemap entries; robots; honest non-diagnostic copy.
- [ ] Booking wired through from the public page; analytics on page → booking conversion (PII-free).
- [ ] Custom domains per org  **deferred** (documented extension).

---

## 🔒 PHASE 18: TRUST, SECURITY & POPIA HARDENING
*Goal: be allowed in the room with the most sensitive data there is.*
- [ ] **Data residency:** migrate Postgres to an SA region (AWS `af-south-1` / Azure SA North) on the `db/client.ts` swap; confirm storage + AI inference residency posture; document cross-border flows.
- [ ] Field-level encryption live; security headers; rate limiting (Upstash) on auth/booking/AI/messaging; observability skeleton.
- [ ] **DPIA**; data-subject tools (export / erasure) wired to real soft-delete + pruner cron; retention policy + breach log.
- [ ] **Opt-out / DMA registry** screen before any marketing send (per the SA direct-marketing registry; manual suppression-list import until the API is published); block + audit if registered.
- [ ] One-click **POPIA pack** per org (consent records + lawful-basis evidence + audit + retention + breach log)  "compliance you can show the Information Regulator."

---

## 🧪 PHASE 19: TESTING & QA
*Goal: prove the invariants that matter  isolation, redaction, consent, safeguarding.*
- [ ] Unit (scheduling, freshness, k-anon, contrast, consent state machine).
- [ ] Integration (Server Actions + Zod + RLS on a real-Postgres harness).
- [ ] E2E (Playwright) across all roles at 1280px + 360px.
- [ ] **Compliance tests:** no PII in public/cross-org payloads; **RLS cross-org isolation**; notes never leak; demographic export respects consent + k-anon; **funder is scoped to its grants + sees only k-anon aggregates + small cells suppressed + every view audited** (no identifiable client reachable as a funder); "AI-generated" labelling present; safeguarding never auto-actions.

---

## 🚀 PHASE 20: LAUNCH READINESS
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

*Last updated: 2026-06-26 · Version 1.0 · Phila · philasa.com · Stack: Next.js · Neon · Better Auth · Supabase Storage · LiveKit*
