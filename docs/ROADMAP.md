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
- [x] **Theme system:** light + dark from one set of CSS variables; a `light | dark` toggle persisted per user (light default, no "system" option  locked to `DESIGN.md` §10; `system` is reserved and trivial to add later); no flash-of-wrong-theme (set before paint). The whole UI is theme-tokenised from commit one.
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
- [x] **Dark + light** verified on every surface (calendar, video room, A4 builder, dossier, public page); the `light | dark` toggle persists; no flash-of-wrong-theme; AA contrast holds in both.
- [x] **PWA:** installable on Android + desktop; offline shell loads; the offline send-queue **stubs** behave (queued booking/note shows a "will send when online" state). Real sync wires in Part B.

**Done when (mock):** a stranger can demo the whole product across all roles on a phone, **in either theme, installed as an app**, it looks finished and alive, and there are zero dead ends. **This is the Part-A ship gate.**

---

## ✅ PART A  COMPLETE (2026-06-28) · 🚪 CLOSEOUT GATE MET
*Whole product, all five roles, on the seam. Closeout: `docs/completed/PHASE_A_COMPLETE.md` + scorecard in
`docs/completed/PHASE_A_CLOSEOUT.md`. Phase 9 plan: `docs/completed/PHASE_9_PLAN.md`. Tagged `part-a-complete`.*

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

## 🔔 PHASE 17.2: SCHEDULING & NOTIFICATIONS POLISH ✅ (2026-07-06)
*Goal: the Hub appointment flow feels complete  the online link is visible, everyone is notified
(in-app + email by default), and booking a client is smooth.*

- [x] **Online join link on the appointment detail**  an online session's detail modal now shows the
  secure room: **Join now** + **Copy link** (signed, org-gated `getAppointmentJoinLink`). Previously the
  room existed but no link was surfaced.
- [x] **Real in-app notifications (the bell was mock)**  a `notifications` table (migration 0029) +
  `db/queries/notifications.ts` + a self-fetching bell (60s poll, unread badge, mark-read on open,
  deep-links). Always-on: no external service needed.
- [x] **Email + in-app are the default notification channels (SMS opt-in)**  `notifyAppointmentBooked`
  fans out on BOTH the Hub's create-appointment **and** the public booking: the client gets an email via
  the rail (real once the admin's Resend integration is on; honestly dormant otherwise) and both the
  counsellor and the client's portal account get an in-app notification.
- [x] **Searchable pickers**  a reusable **`SearchSelect`** combobox (`components/ui/search-select.tsx`,
  extracted from the messaging search pattern); the New-appointment modal's **Client** + **Counsellor**
  dropdowns are searchable.
- [x] **“New client” inline in the client dropdown**  name/phone/email → `createClientForBooking`
  creates the client with **the selected counsellor as primary** (selection required  no silent
  fallback) and selects them for the booking.
- [x] **Creative “Where” cards**  In person / Online as icon cards (room vs secure video) instead of
  plain radios.
- [x] **Notification credits**  seed grants a healthy starter balance (**500 SMS / 1000 email**,
  ledgered + idempotent); the super-admin tops up any org at `/admin/orgs/[id]` → **Notification
  credits** (channel + amount, ledgered, audited). Orgs self-serve packs via Billing & usage (15.1).
- [x] Tests: notifications create/list/unread/mark-read + counsellor resolver; balance resets aligned.

---

## 📁 PHASE 18: DOCUMENT SYSTEM  HUB-FIRST, SUPABASE-BACKED
*Goal: a beautiful, smooth document workspace for the org  folders, drag-to-move, assign-to-client,
request-gated client uploads, and org→counsellor sharing  all on Phila Storage (Supabase), POPIA-safe.*

> **Full write-up: `docs/completed/PHASE_18_COMPLETE.md`** (plan: `docs/completed/PHASE_18_PLAN.md`). Real file storage was always staged to land "with the documents
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

## 📝 PHASE 18.6: FORMS  ORG FORMS LIBRARY ✅ (2026-07-01)
*Goal: evolve the single, mock intake form into a real, DB-backed forms library  many forms per org (intake,
feedback, screening, consent, custom), sent to one or many clients, with responses collected and reviewable.
Intake becomes one form kind, still driving booking. Full write-up: `docs/completed/PHASE_18.6_COMPLETE.md`
(plan: `docs/completed/PHASE_18.6_FORMS_PLAN.md`).*

- [x] **Commit 1  data model + seam + docs:** new `forms` + `form_assignments` tables (migration
  `0025_secret_lyja.sql`), **RLS** org-scoping, `db/queries/forms.ts` (real reads + writes), the provider seam
  (interface + **mock** in-memory store + **db** wired in `lib/db-provider.ts`), domain types (`Form`, `FormField`,
  `FormAssignment`, `FormSnapshot`; `IntakeForm`/`IntakeField` kept as aliases so booking doesn't churn), fixtures
  (`orgForms`, `formAssignments`) **seeded into Neon** so `DATA_PROVIDER=db` serves identical data. Responses render
  from a **snapshot** frozen at send time (editing a form never rewrites past answers). `getIntakeForm` now resolves
  the active intake form from `forms`.
- [x] **Commit 2  library + builder + preview:** nav Intake→**Forms**; `/hub/forms` (card grid, archived section,
  empty state); `/hub/forms/new` + `/hub/forms/[id]/edit` (`FormBuilder`  kind selector + starter templates);
  `/hub/forms/[id]` (`FormDetail`  Questions/Preview tabs); shared `components/forms/form-fields.tsx` (one renderer
  now powering booking intake + hub preview + client fill); `saveForm`/`duplicateForm`/`setFormArchived`;
  `/hub/intake` redirects to `/hub/forms`; removed superseded intake-tracker/editor/actions.
- [x] **Commit 3  send + responses:** `SendFormModal` (searchable client multi-select + select-all) → `sendForm`
  action → `sendFormToClients`; Responses tab (stats + list + View answers via the shared dialog) with a Send button;
  `form_sent` notification (templates + Zod enum + template-manager) + `lib/messaging/notify-form.ts` (dormant-by-default,
  builds the `/f/<token>` link). Re-seeded `form_sent` templates into Neon.
- [x] **Commit 4  client fill:** public `app/f/[token]` route (no login) → `FormFillView` (shared renderer +
  reused validation) → `submitForm` (server re-validates required fields against the snapshot); calm confirmation +
  invalid/already-submitted states; SADAG crisis line. `/me/forms` portal surface + `clientNav` entry.
- [x] **Commit 5  Form Designer + share link:** a **Design** tab (`FormDesign`)  form-only vs form + hero panel
  (stacks on mobile), editable hero copy, background (gradient / solid colour / uploaded image counting against org
  storage, cover/contain fit + colour overlay & opacity) with a live preview; themed two-pane rendering on
  `/f/<token>` (`form-theme.tsx`, server-signed image URL); an **open share link** anyone can fill (`FormShare`),
  each share submission a fresh response row. Migration `0026` (theme + share on `forms`, nullable client +
  respondent on `form_assignments`); seeded a themed split feedback form + share link.
- [x] **Commit 6  polish + docs:** refreshed `docs/DEMO_LOGINS.md` (Forms + share link; fixed the stale
  one-click-buttons note), marked 18.6 done. Deferred as a future nicety: mirroring a completed booking intake into a
  `form_assignments` row (booking + the intake board are unaffected either way).

**Done when:** an org can build a library of forms, send them to one or many clients, collect + review responses, and
share an open, themeable link  all DB-backed and RLS-scoped. ✅ **Met** (tsc/lint/build + 119 tests green across the
six commits; migrations 0025–0026 + seed applied to Neon).

---

## 👤 PHASE 18.7: CLIENT ONBOARDING  PHONE-OR-EMAIL, PORTAL INVITE, FULL EDIT ✅ (2026-07-02)
*Goal: make the client front door match how SA practices actually work  a **phone number *or* an email** is enough
(many clients have no email), invite a client to their portal over the right channel with a copy-paste fallback, and
let the org fully edit a client's profile. One policy applied at every door a client is created. Full write-up:
`docs/PHASE_18.7_CLIENT_ONBOARDING_PLAN.md`.*

- [x] **Create with phone *or* email (hub):** shared `contactShape` + `.refine(phone || email)` on `createClient`;
  the Add-client modal shows a combined contact error when both are empty and a helper line teaching the invite
  behaviour ("we invite by email when there's one, otherwise by SMS").
- [x] **Channel-aware portal invite + copy link:** `InviteClientButton` defaults to **email when present**, else SMS,
  else WhatsApp (each disabled when the channel isn't connected); a dashed **"Can't tap the link?"** block shows the
  full activation URL with a **Copy** button so the org can paste it into any browser. `inviteClientToPortal` returns
  the shareable path.
- [x] **Full client edit:** `updateClient` (validated + audited, same phone-or-email rule) + a pre-filled
  `EditClientButton` on the client detail page  name, phone, email, province, primary counsellor, safeguarding flag.
- [x] **Booking consistency:** the public booking flow (which also creates a client record) now enforces the *same*
  phone-or-email rule at the server boundary; the shared intake validator gains an opt-in `contactPair` so a client
  with only a phone *or* only an email can book (each still format-checked), with a "one is enough" hint. Generic
  Forms fill (`/f/[token]`) is untouched.
- [x] **DB-backed (no more mock):** the whole hub clients cluster now hits Postgres under `DATA_PROVIDER=db` 
  `db/queries/clients.ts` (create / update / reassign / soft-delete + restore, org-scoped) and real reads in
  `lib/db-provider.ts` (`listOrgClients`, `listRemovedClients` for the Removed tab, `getClientDossier` with
  consent-gated demographics, `findDuplicateClients`). Actions `revalidatePath` + `router.refresh()` so the caseload
  reflects the DB live. Verified end-to-end against Neon (a phone-only client wrote a real row and appeared on refresh)
  and via Playwright screenshots of the Add / Invite-with-copy-link / Edit modals.

**Done when:** a client can be created, invited, and edited with only a phone number **or** only an email, over every
front door (hub + booking), persisted to Postgres, with a shareable link when messaging can't reach them. ✅ **Met**
(tsc/lint/build + 119 tests green; verified against Neon). *Real invite tokens + delivery stay Phase 12  the invite
is recorded to `audit_log` and the copy link points at the client activation page today.*

---

## 🔁 PHASE 18.8: CASELOAD TRANSFER + RESCHEDULE REASON ✅ (2026-07-06)
*Goal: when a counsellor leaves (intern rotation, contract ends), the org hands their whole caseload
over in one smooth step  and any reschedule can carry a reason kept on the record.*

- [x] **Transfer caseload (bulk)**  on the team member page (`/hub/team/[id]` → Caseload → **Transfer
  all**): pick the receiving counsellor (searchable), one confirm. `transferCaseloadDb` re-points every
  active client's **primary counsellor** and moves all **future scheduled sessions**; sessions that clash
  with the receiver's diary are **skipped + reported** (per-row move, the GiST no-double-booking constraint
  stays authoritative). The receiver gets an **in-app handover notification**. Audited.
- [x] **History stays intact**  past sessions, notes, outcomes, and documents are never touched; only the
  client's primary pointer + future diary entries move. Proven by test (a completed past session keeps its
  original counsellor + state).
- [x] **Per-client reassign upgraded**  the existing client "Reassign" now also brings the client's
  future sessions to the new counsellor (same clash-skip), with honest toast counts.
- [x] **Reschedule with optional reason**  the appointment detail's Move form takes an optional note
  (`reschedule_note`, migration 0039), shown on the record ("Rescheduled  reason"); works for counsellor
  and org (both use the same detail modal).
- [x] Fix: `isSlotTakenError` now walks the error **cause chain** (deferred exclusion constraints surface
  at COMMIT wrapped in a driver error).
- [x] Tests: transfer integrity (clients + future moved, clash skipped, history untouched), single-client
  reassign brings sessions, reschedule note round-trip.

---

## 🛠️ PRODUCTION READINESS (W1–W7)  cross-cutting hardening pass
*Tracked in full in `docs/PRODUCTION_READINESS_PLAN.md`; overlaps Phases 19–21. Status below.*
- [x] **W1  Team & lifecycle:** team management (invite → activate, roles & honest reach), mandatory
  **email verification** + branded onboarding/admin-approval lifecycle on a **17-day no-card trial**,
  Settings company profile + Billing trial countdown. Landing `?plan=` carries the chosen plan into signup.
- [x] **W2  Security hardening:** HSTS/CSP + security headers (`next.config.ts`), webhook **HMAC**
  (WhatsApp), **timing-safe** Paystack/LiveKit token checks, LiveKit join links bound to the appointment,
  document-upload extension checks, **fail-strict clinical audit**, per-IP auth rate limiting, and the
  RLS **runtime cutover** (request path on the `phila_app` role  see Phase 10). Platform Users management.
- [x] **W3  Feature governance & plans:** the entitlement resolver (kill-switch → per-org override →
  plan → self-toggle), `/admin/features`, per-org overrides + resource meters/quotas, and a DB-backed,
  **super-admin-editable plan catalogue** (`plans` table; edits apply to every org on the plan  no drift).
- [x] **W4  Seed & demo realness:** every role/page has real data; all four counsellors have live days;
  the M&E cohort has time-anchored sessions (grants read real "sessions delivered"); supervision queue,
  document shares, payments, and public-page analytics seeded; invoices now-relative; a **second, fully-real,
  RLS-isolated tenant** (Thrive EAP).
- [x] **W5  Docs hygiene:** README/DESIGN/SECURITY/SMOKE_TEST/ROADMAP reconciled to the shipped reality.
- [x] **W6  UX & org-settings IA:** org **branding + logo** (shown on the public booking page, counted
  against the org's storage quota); the **invoice model** made real (an invoice is generated at booking, and a
  client can pay it online when the org's gateway is connected); the **client change-request flow** (clients
  never edit a booking  they **request** a reschedule/cancel with a reason, gated by the org's configurable
  notice window, which notifies the practice); a top-level **Messaging** summary tab in Settings; and the
  Security & data surfaces.
- [x] **W7  New features (the moat):** every differentiator shipped, each in the W3 feature registry,
  Dormant-by-Default and admin-rollable  **sliding-scale / subsidised fees** (per-client fee policy flowing
  into the auto-invoice), **unified client timeline**, **referral / source tracking** (org-toggleable),
  **no-show follow-up** (one-tap rebook), **outcome trends** (PHQ-9 **and** GAD-7 as separate per-tool trends),
  the **funder/M&E report pack** (real print-to-PDF, k-anonymised), **waitlist auto-fill** (a cancelled slot
  offers itself to matching waiting clients), **WhatsApp-first comms** (the free 24-hour service window
  engineered end-to-end  free-form in-window, approved template out-of-window, honest skip otherwise; WhatsApp
  promoted to the primary channel with a Test-connection ping; BYO encrypted Meta creds), and the **client
  portal** reschedule/cancel (on every upcoming session) + pay-via-pay-link. *(Only the optional, out-of-scope
  medical-aid invoice formatting remains.)*

---

## 🛡️ PHASE 31: COMPLIANCE & DATA-SUBJECT READINESS ✅ (2026-07-21)
*POPIA × HPCSA legal-readiness, built to the "never complicate an org's life" principle - computed
retention clocks (6y / minors→21 / incapacity; one advisor-editable file), one-click DSAR export +
honoured-where-lawful erasure + legal holds (fail-strict audited), a report-only pruner cron gated on an
explicit platform enable, the s22 breach register with audit-derived affected-subjects + a drafted notice,
the one-click POPIA pack (`/reports/popia`), the platform s72 sub-processor register orgs inherit, the
dismissible IO nudge, `docs/compliance/` (DPIA · IO checklist · DPA register), and the CI compliance
sweep (no client PII in funder payloads + suppression proven live, AI labelling, no safeguarding
auto-action). Closes the Phase-19 DSAR/retention/breach/pack items and broadens Phase 20's tests.
Closeout: `docs/completed/PHASE_31_COMPLETE.md`.*

---

## 📣 PILOT FEEDBACK  BATCH 1 (~10 items, delivered one at a time)
*Real usage feedback worked through item by item - each one built, **proven live with screenshots**
(kept in `screenshots/`), tested, and committed before the next begins. Started 2026-08-04.*

- [x] **#1  Calendar truth + liveness** *(2026-08-04 · `9ba231b`)*: a new appointment appears on the
  calendar **without a refresh** (`router.refresh()` on create + render-time state re-sync), and events
  render at the correct **SAST** wall-clock time (an 11:00 booking showed 09:00 - UTC slicing replaced
  with `Africa/Johannesburg` Intl formatters). Also: every outbound transport fetch got a 10s
  `AbortSignal.timeout` and booking actions cap the notify wait at 4s, so a slow provider can never
  hang a booking.
- [x] **#2  Calendar filters** *(2026-08-04 · `2bbef07`)*: filter the calendar by **counsellor**
  (searchable avatar dropdown, defaults to "All counsellors") and by **type** (All / In person / Online -
  hybrid arrives with a later feedback item). Two-row header (filters + New on top; ‹ Today › + date
  range + Day/Week/Month/Agenda below). The avatar+role-subtitle dropdown style is now the shared
  `SearchSelect avatars` mode, used consistently (messaging picker, booking modal, calendar).
- [x] **#3  Dashboard rework** *(2026-08-04 · `809fe69`+`6c2aacc`)*: Picktime-inspired `/hub` overview -
  **period filter** (Today / This week / This month / Last month), tiles for bookings + **income received /
  projected** (projected = unpaid invoices *issued* in the period), a **Paid online vs Cash / Card / EFT**
  payment split (gateway orgs), the bookings **area chart** (house SVG style), **Coming up next**, and the
  **Activity feed** (the org's own audit trail, humanised; read-noise excluded). Outcomes-captured /
  credential-checks / open-intakes tiles retired.
- [x] **#4  Counsellor offboarding - archive-only** *(2026-08-05 · `283aa7f`)*: "delete counsellor" done
  the Phila way - **nothing is ever deleted** (HPCSA record-keeping). The offboard dialog shows the
  member's honest workload, then either **migrates** the caseload + future sessions to a successor
  (history stays put) or **cancels** upcoming sessions with clients notified; sign-in is revoked,
  every note/session/outcome stays on the record permanently, and the member can be restored. Audited
  (`archive_member_migrated` / `_cancelled`); integration-tested (nothing-deleted proven).
- [x] **#5  Counsellor availability** *(2026-08-05 · `b5b5bca`)*: **org-managed** weekly working windows
  per counsellor (`counsellor_availability`, migration 0056 + RLS) - no pattern = follows the practice
  hours; counsellors see theirs **read-only** (only the org edits; every save audited as
  `update_availability` → Activity feed). The **hub modal** live-filters the counsellor list once a
  date + time are picked ("3 of 6 counsellors available at 10:00"). The **public booking page** drops
  the counsellor-selection step entirely (new clients don't know the team) - a time is offered while
  *any* counsellor is free, several counsellors can hold the same hour, and each booking auto-assigns
  to the **least-loaded** free counsellor that day. Proven by `tests/integration/availability.test.ts`.
- [x] **#6  Held by phone** *(2026-08-05)*: sessions that actually happened over a **phone call**
  (client had no data) are recorded honestly - **not** a booking type, an after-the-fact record. The
  session page gets a "Held by phone" card: one tap records the **real call duration** (prefilled with
  the booked length) + optional context; undoable. The marker shows on the session header, the sessions
  list, the calendar appointment detail, the hub read-only session view, and the client timeline; the
  clinical note is untouched. Stored as `held_by_phone` + `call_duration_min` + `phone_note`
  (migration 0057); audited as `session_held_by_phone` → Activity feed.
- [x] **#7  Hybrid session type** *(2026-08-05)*: a third type - **online for the client, in-person
  for the room**. The counsellor holds a practice room (required, conflict-checked, counts toward room
  utilisation) while the client joins by the normal secure video link; the client experience is
  identical to online. Booking modal gains the Hybrid "Where" card; the calendar type filter becomes
  All / In person / Online / Hybrid; detail + session views show "Hybrid · room · client joins online".
  Implemented via `isRemote()` / `needsRoom()` predicates in `lib/domain/enums.ts` replacing scattered
  `=== "online"` checks (no migration - the type column is text). Public booking untouched (an internal
  operational choice).
- [x] **#8  Rooms fully functional** *(2026-08-05)*: the Assign-counsellor flow - a Part-A mock until
  now - **persists for real** (`db/queries/room-assignments.ts`): many counsellors per room, each on
  their own day/time pattern, so rotation ("Room 1 Mon, Room 2 Fri") is just rows; removable; audited →
  Activity feed. Saves are **availability-aware** with honest warnings (the counsellor's working
  windows, their other rooms, this room's other claims) + "Assign anyway". **"Who was in this room"**
  on the room page answers the record question for any date (counsellors · sessions · hours, from the
  permanent appointments record). `/hub/rooms` gains a live **"Right now"** band (N of M in use,
  pulsing per-room chips), room cards get an **"In use · who · until when"** flag and a relative
  **Next up** timeline, and the dashboard gains a **"Rooms right now"** widget.
- [x] **No-mock sweep** *(2026-08-05)*: audited every provider method + server action for mock
  leftovers. Fixed: **counsellor "Your week in rooms"** read the mock (a saved assignment never
  reached the counsellor) → real DB override; **staff profiles** were `profile: null` in DB mode
  (blank member pages) → new `team_profiles` table (migration 0058 + RLS), seeded, read by the team
  detail, and **saveMyProfile persists** (name follows to user + counsellor rows); **changePassword**
  (staff) now routes through Better Auth (verify → re-hash → revoke other sessions);
  **sendInvoiceReminder** actually sends (platform email with the pay-link when the gateway is on +
  an in-app portal notification, honest per-channel toast). Confirmed dead-but-unused: 4 legacy
  interface methods (conversations, counsellor invoices, intake) superseded by messaging/invoicing/forms.
  2FA toggle stays an honest audited placeholder until the W2 TOTP enrolment UI.
- [x] **#9  Export on Clients & Team** *(2026-08-06)*: an **Export** dropdown (CSV · Excel · PDF) on
  `/hub/clients` and `/hub/team`. Zero dependencies: CSV (UTF-8 BOM), Excel (SpreadsheetML - opens
  natively in Excel), PDF (print-styled window → Save as PDF, org name + date + count header). Files
  match the live list; client exports are audited **`pii.export`** (fail-strict class), team exports
  as admin actions - both carrying format + row count. Shared `ExportMenu` (portaled, reusable for
  any future list).
- [x] **#10  The waiting room** *(2026-08-06)*: a genuine join link clicked before the session no
  longer dead-ends on "Session unavailable" - it seats the client in a calm **waiting room** (session
  details, live countdown, "doors open 15 minutes before") that lets them in automatically when the
  window opens. The fix splits signature verification from the time window (`verifyJoinSignature` +
  `joinWindow` in `lib/video/livekit.ts`; media tokens still only mint in-window). Honest endings too:
  a link after T+3h says "this session has already taken place", a cancelled session says so. The
  portal card's Join button is never dead - early it reads **"Open waiting room"**. Unit-tested
  (early/open/closed + tamper) and proven live.

**Batch 1 complete - all 10 items delivered, each proven live before commit.**

## 📣 PILOT FEEDBACK  BATCH 2
- [x] **Invoicing fully functional** *(2026-08-06)*: booking-time invoicing already worked for single
  bookings, but recurring-series members and completed sessions never billed (190 completed sessions ·
  ~R85 550 unbilled in the demo org). Now: **completion is the billing moment** - marking a session
  Completed auto-raises its invoice (`ensureInvoiceForAppointmentDb`, sliding-scale fees + the org's
  auto-invoice toggle honoured); the **appointment detail shows its invoice inline** (number · amount ·
  Paid/Unpaid chip · Open invoicing) with a **Generate invoice** button when missing; the **Invoicing
  page banner** surfaces every completed-but-uninvoiced session ("190 sessions · R85 550 unbilled")
  with one-click set-based backfill (185 invoices in seconds, sequential numbering); **Bill to** in the
  invoice builder is the searchable avatar client picker. All audited; proven live.
- [x] **Supervision - both sides + classrooms** *(2026-08-06)*: supervision was supervisor-only; now
  the SUPERVISED counsellor's `/app/supervision` shows **"Your supervision"** - their supervisor
  (card + Message link), notes **awaiting review**, **changes requested with the supervisor's
  feedback** (deep link to revise), and recent sign-offs; every sign-off decision now fires an
  **in-app notification** to the author. Plus **supervision classrooms** (Google-Classroom style,
  native): `supervision_classes/_members/_posts` (migration 0059 + RLS), a **`/hub/supervision`**
  page (nav item) where the org creates a class per supervisor - **supervisees auto-rostered**, join
  code on the card, org-managed roster - and a shared **stream** in `/app/supervision` for the
  supervisor (posts tagged "Supervisor") and members (replies + in-app notifications to the class).
  Foundation for classwork/assignments later. Proven live end-to-end.
- [x] **Class sessions + attendance** *(2026-08-06)*: classrooms hold real **live sessions** -
  the supervisor schedules one (title · date/time · duration · **online or in person**); everyone is
  notified in-app and the session auto-posts to the stream; **online sessions carry a Join button**
  into a staff-only video room (`/class-room/[id]`, authorised by org membership - supervisor, class
  member, or org admin; same waiting-room/doors-open logic as client sessions). After a session the
  supervisor marks the **attendance register** (Present/Absent per member) - kept permanently as
  supervision/CPD evidence, "N present · M absent" on the session row, audited. Also fixed: the video
  token API rejected **hybrid** appointments. Tables `supervision_class_sessions` + `_attendance`
  (migration 0060 + RLS).
- [x] **Operational reports** *(2026-08-06)*: a **Reports** tab in Insights (Picktime-style, fully
  live): seven report types over the permanent records - Bookings summary · Cancelled (with reasons) ·
  No-shows · By counsellor (booked/completed/no-shows/hours/billed/collected) · By service · Fully
  paid · Payment pending (overdue flag) - across six periods (Today → YTD), with **search within
  results**, honest totals lines, coloured status chips, and the shared **CSV / Excel / PDF export**;
  report views audited `pii.read`, every export audited **`pii.export`** with type+format+row count.
  (`db/queries/reports.ts`, `components/hub/reports-tab.tsx`.)
- [x] **One export everywhere + a hydration bug hunt** *(2026-08-06)*: the shared **ExportMenu
  (CSV · Excel · PDF)** is now the house standard - **Funder reporting**'s old Download-CSV button
  replaced (k-anon suppression written through as "suppressed (<k)"; audited `funder_export_k_anon`
  for every format), the **Practice tab** gained the export (period metrics vs previous period), and
  the **platform audit ledger** export moved to it (and exporting the ledger is now genuinely
  audited - the old button only *claimed* to be). En route, found & fixed a real bug: money rendered
  with `toLocaleString("en-ZA")` differs between Node ("1,800") and Chrome ("1 800"), causing React
  hydration failures that silently killed click handlers (the funder Export was dead). New
  deterministic `za()` formatter (`lib/format.ts`) swept across all 20 client components.
- [x] **House style: no em-dash** *(2026-08-06)*: the em-dash (U+2014) is banned project-wide (it
  reads as machine-written). Swept 616 occurrences across 191 files (UI copy, comments, docs, seed
  data) plus rows already in the database; enforced forever by `tests/unit/no-em-dash.test.ts` (CI
  fails on a single one) and recorded as a standing rule in `TO_START_EVERY_SESSION.md`.
- [x] **Classroom editing** *(2026-08-06)*: **Edit** on every classroom card (name · description ·
  hand the class to another supervisor - the roster stays; audited `update_classroom`), and in the
  stream everyone can **edit or delete their OWN posts** (hover controls, inline editor;
  author-only enforced server-side - proven: another member's posts show no controls and the
  server rejects edits to others' posts).
- [x] **Phase 32.0 - language of record** *(2026-08-06)*: the counsellor/client language mismatch
  becomes visible, honest data (full plan: `docs/PHASE_32_LANGUAGE_PLAN.md`). A global `languages`
  reference table (BCP-47, 3 honest capability tiers) + `org_language_settings` (RLS'd);
  counsellors carry **spoken languages** edited as native-name toggle chips on the team member
  page (grouped "Live translation ready / Content in language / Recorded only", audited);
  clients carry **home language + interpretation_needed + how the gap is handled today**
  (family / staff interpreted, struggled through, rebooked), recorded from the dossier and
  filterable + exportable in the clients hub. The public booking wizard gained a **Language step**
  (native names, Tier 3 behind "Another language"); auto-assign **prefers a counsellor who speaks
  the client's language** before least-loaded (proven: an isiXhosa booking assigned the isiXhosa
  speaker), and `interpretation_needed` is computed honestly at intake. The hub appointment modal
  hints **"Speaks isiZulu"** per counsellor and counts free speakers in the availability caption.
  Migrations 0061/0062; home_language is SPECIAL PI (demographics-gated, k-anon on export).
- [x] **Language behind a real switch** *(2026-08-06)*: `language` is a registered org feature in
  the entitlement chain (platform kill-switch → per-org override → plan → the org's own toggle).
  The super admin can turn it off across Phila from **Feature control**; each practice has its own
  honest **Language of record** switch in Settings → Integrations (locked with the reason shown
  when Phila decides). Off = the system runs exactly as before 32.0: the booking wizard drops the
  Language step, the team Languages card / dossier control / clients filter + export column /
  modal speaker caption all disappear, server actions refuse language writes, and matching
  ignores language - while anything already recorded is kept, never deleted. Proven live both
  ways: killed platform-wide → every surface gone; restored → the step returns instantly.
- [x] **Counsellors continue care, the practice opens it** *(2026-08-06)*: a counsellor can no
  longer create fresh bookings from the workspace - the dashboard's New-appointment button (+ its
  Ctrl-K hotkey) and the calendar's click-to-book are gone, and `/app` Appointments is renamed
  **Calendar** (own sessions only: no team filter, own clients only in the rebook modal). What
  they CAN do is the clinical moment they own: a **"Sessions running out"** dashboard card
  surfaces their recurring series with <= 2 sessions left (incl. one that just ended) and **Add
  sessions** extends the same series - same day, time, room - by 2/4/6/12 weeks, conflict-checked
  atomically by the DB, audited (`extend_series:N`), client notified. Server-side honesty:
  `createAppointment` (which previously had NO auth guard - fixed) now requires a booking role
  and lets a counsellor book only themselves for a client already in their care (a no-show
  rebook), and `extendSeries` refuses another counsellor's series. The Hub keeps full booking
  powers, proven unchanged.
- [x] **Overview widgets: one height, filterable team** *(2026-08-07)*: every hub Overview widget
  (Coming up next · Activity feed · Team this week · Needs attention · Rooms right now) now sits
  in one calm grid at a shared 380px height with content scrolling INSIDE the card - the page
  stays a dashboard, never a long feed. **Team this week** gained filter chips with live counts
  (All · Near capacity · Has room · Unverified) plus a name search, so "who's stretched / who has
  room / whose credentials still need verifying" is one click. Proven live: card heights measured
  equal, the activity feed scrolls internally, filters and search verified.
- [x] **Coming up next: type filter** *(2026-08-07)*: the widget now fetches the next 20 sessions
  (was 5) and filters them by how they happen - chips with live counts (All · In person · Online
  · Hybrid), count pill tracking the filtered list, honest per-type empty state, same shared
  widget height with the list scrolling inside. Proven live: Online shows only Online-chip rows,
  In person shows none.
- [x] **The org inside its classrooms + recurring class sessions** *(2026-08-07, batch 2e)*: the
  practice is never locked out of its own rooms. **Open classroom** on every hub card drops the
  org into the SAME stream the class sees - every post, every session, the join link. The org can
  **post as the practice** (badged "Practice", stand-in when the supervisor is away - server
  falls back to the org identity only when the author isn't a class member), **schedule
  sessions**, **mark registers**, and **join online class sessions** (the room + token API admit
  org admins; early clicks get the waiting room, never a bounce). And a **Repeat weekly** toggle
  on Schedule session (both /app and hub) books the same slot for 2/4/6/8/12 weeks in one go -
  the class is notified once, the stream announcement says "weekly for N weeks". Migration 0063
  (`is_org` on posts). Proven live end to end from both sides.
- [x] **Service colours on the calendar** *(2026-08-07, batch 2f)*: every service picks a
  **Calendar colour** on the Services page (the house six-colour palette, same family the rooms
  use; a new service auto-picks an unused one, and a **rainbow swatch opens the native picker**
  for any colour of your own) and calendar events **wear their service's colour** - tinted fill, soft border, full-strength text - across the week/day grid, month
  minis, and agenda (left stripe). Warning states keep their tones: risk stays red, no-show
  amber - the colour never hides a problem. Migration 0064 (`services.colour`); seeded palette
  for the demo services. Proven live: computed event colours matched the service hex, and
  changing a colour on Services re-painted its events.
- [x] **Fee arrangements reworked** *(2026-08-07, batch 2g)*: the client dossier's fee picker is
  now three honest options - **Standard**, **Waived (funded)** (grant/donor), and **Waived
  (company retainer)** (the EAP case, a distinct `retainer` kind so finance reporting can tell
  employer-covered from grant-funded). Sliding scale + fixed fee are RETIRED from the picker and
  the server action; existing clients on a legacy arrangement keep displaying and billing
  correctly (records never distort) until the org changes them. Retainer bills at R0
  automatically; Megan Pillay seeds the demo case. Proven live incl. a DB-asserted save.
- [x] **Waitlist + Outcome tracking behind admin switches** *(2026-08-07, batch 2h)*: both are now
  registered org features in the entitlement chain with honest descriptions - **Client waitlist**
  ("hold clients waiting for a space and book them in the moment a slot opens") and **Outcome
  tracking** ("measure client progress with PHQ-9 / GAD-7 between sessions"). The super admin gets
  kill-switch cards in Feature control; each practice gets described switches in Settings →
  Integrations (locked with the reason when Phila decides above them); a generic OrgFeatureToggle
  component now serves future switches. Off = the queue card, dossier Add-to-waitlist, outcome
  tiles/trends/capture and the counsellor dashboard Outcomes card all disappear, and the server
  actions refuse writes - while waitlist entries and captured measures are kept, never deleted.
  Proven live both ways on the production build.
- [x] **The org fully edits counsellor profiles** *(2026-08-07, batch 2i)*: an **Edit profile**
  dialog on every team member page - name, phone, date of birth, address, bio, display languages,
  specialties, and repeatable education/qualification rows, plus (counsellors) the professional
  **credential** (body + registration number). Changing the credential honestly resets its
  verification to **pending** - the dialog warns before saving and the toast points at the
  Verification flow; an unchanged credential keeps its verified status. The name updates the auth
  user AND the counsellor row together. Audited (`update_member_profile[_credential_reset]`).
  Proven live: full edit round-trip DB-asserted on user + counsellors + team_profiles, and the
  credential reset verified.
- [x] **EAP companies - employers fund sessions, employees stay invisible** *(2026-08-07, batch
  2j)*: a **Companies** area in the hub. A company carries contacts, a negotiated per-session
  rate (or list price), a **retainer ledger** (record payments), and an **employee booking
  link**. An employee who books through the link becomes an ordinary client, invisibly linked
  (`clients.company_id`), fee set to **company retainer** (they pay R0 - no invoice raised), and
  the wizard tells them honestly: "your employer only ever sees anonymous usage numbers, never
  who came." Usage = held sessions of linked clients x rate, drawn against payments - the company
  page shows Paid / Used / Remaining / Sessions with a month-by-month table, and the **report
  export** (house CSV/Excel/PDF) is aggregate-only with the confidentiality line printed on it.
  Migration 0065 + RLS. Proven live end to end: company created, R10 000 recorded, an employee
  booked through the link (banner shown, retainer + link DB-asserted, R0 billing), the session
  drew R400 down to R9 600, and the exported CSV contained NO employee name.
- [x] **Documents: links, folder notes, private submissions** *(2026-08-07, batch 2k)*: a document
  can now be a **LINK** (e.g. a Google Doc - opens in a new tab, uses no storage; migration 0066)
  added by the org (Add link on Documents) or by a counsellor into a shared folder. Sharing a
  folder gained a **note** ("what to do here"), a **Select all counsellors** shortcut, and a
  **"Counsellors see only their own files"** switch: in such a folder each counsellor sees the
  org's material plus ONLY their own submissions - never another counsellor's (server-filtered,
  not hidden client-side). The counsellor's Documents page shows shared folders as cards with the
  note, Add link, and **Download all**; the hub gained a **Download** selection action and View
  for links. Also fixed: optimistic folder ids now reconcile to real ids, and link-adds validate
  the folder server-side. Proven live: org shared a CPD folder to all counsellors with a note +
  privacy; Aisha added her completed Google-Doc link and saw it; Thabo saw the template + note
  but NOT Aisha's file; the org saw both.
- [x] **Three-dots menus on documents** *(2026-08-08)*: a reusable `KebabMenu` (portaled, Esc /
  click-outside / scroll closes) puts per-item actions one click away instead of ctrl-click
  selection. Hub document rows: Open or Download · Rename · Assign to client · Share with
  counsellors · Delete. Hub folder cards: Open · Rename · Share · Delete (replacing the
  hover-only pencil). Counsellor side: on their OWN link submissions - Open · Edit link ·
  Remove, both server-guarded to the owning counsellor. Proven live: menu items render, rename
  and delete round-trip to the DB.
- [x] **Forms: the engine** *(2026-08-09, batch 2l)*: every input type - short text, paragraph,
  number, date, phone, email, single choice, dropdown, tick-all-that-apply (optional cap), linear
  scale with end labels (the K10 shape), acknowledgement tick, plus statement and **section**
  blocks. A section is a page break, so a long form becomes a **multi-step wizard** with a
  progress rail, Back/Continue, per-step validation and a submit-time sweep that returns the
  client to the first step holding a missed required answer. Multi-answers ride as a joined
  string, so snapshots/exports/DB are untouched. The builder gained the full type picker, options
  for every choice type, scale points + labels, and honest block handling.
- [x] **Forms: the flow** *(2026-08-09, batch 2l)*: **automations** - "send this form when a
  booking is made (optionally first booking only)" or "after their Nth attended session" - fire
  from the hub modal, the public booking page, and the moment a session is marked held; each
  client gets a given form once (structural idempotence), and an automation never breaks the
  action it rides on. The org **shares a form with counsellors** (all, or named), who get a
  **Forms page** in their workspace: what's shared with them, Send to their OWN clients only
  (server-guarded both ways), and every response their clients returned - openable in full.
  Completed responses also land on the **client record** in both the counsellor dossier and the
  hub, rendered from the assignment snapshot (with a summed score for scale forms). Migration
  0067 (`form_automations`, `forms.shared_with*`) + RLS. Proven live end to end: automation
  fired on the 2nd attended session, a counsellor sent to their own client (another counsellor's
  client never listed), the client filled it, and the answers appeared for the counsellor and on
  the record.
- [x] **Multi-step templates + a visible way to add steps** *(2026-08-09)*: the New-form template
  picker gained **Full intake (3 steps)** - the real SA intake shape (about you · health &
  history · consent acknowledgements, with dropdowns, tick-all, statements and acknowledgement
  ticks) - and **K10 distress scale (2 steps)** (the ten Kessler questions as linear scales).
  Each chip shows its question and step count. In the builder, an **Add step (section break)**
  button sits beside Add question, section cards render as accent-edged **"Step N starts here"**
  dividers, and a **"N steps for the client"** badge tracks the header - so multi-step is
  discoverable instead of a hidden field type. Also raised the question-label cap from 120 to
  300 characters (real consent questions are long, and the save failed silently at 120).
- [x] **One filter for the whole dashboard** *(2026-08-09, batch 2m)*: the Today / This week /
  This month / Last month filter no longer moves only the stat tiles - it drives the widgets
  beneath them. Every period's slice is computed server-side up front (`lib/dashboard/periods.ts`
  holds the SAST windows the tiles already use), so switching is instant with no refetch:
  **Coming up next** lists that period's sessions (future-only for a window that contains now,
  the whole month for a past one), the **Activity feed** shows that period's events, and
  **Team this week** retitles to **Team today / this month / last month** with the load recomputed
  against a capacity scaled to the window. **Needs attention stays unfiltered on purpose** and
  says **"always current"** - a safeguarding flag or a pending credential is a standing state, not
  something that happened inside a date range, and hiding live risk behind a filter would be
  dangerous. Two honesty fixes rode along: the audit pull now covers the whole period window (so
  Last month shows last month's activity, or an honest "Nothing recorded last month"), and Today's
  bookings chart widens its hours to cover an out-of-hours session instead of drawing an empty
  chart under a tile that counts it.
- [x] **A dashboard session opens where you clicked it** *(2026-08-10, batch 2m)*: rows in
  **Coming up next** used to link to `/hub/appointments` and leave the reader to find the booking
  again. They now open the real appointment in place - the same `AppointmentDetail` card the
  calendar uses, with reschedule, completed / no-show / postponed, cancel, the join link and
  View client. The full appointment behind every visible row is already loaded for the widgets,
  so opening one costs no extra fetch, and an edit refreshes the dashboard behind the modal.

- [x] **Availability per session type** *(2026-08-10, batch 2n)*: a counsellor's weekly hours now
  carry a **mode** - "Any session" (the base pattern), **In person**, or **Online** - edited through
  three chips with live counts. Booking asks the question the way it will actually happen: the hub
  modal re-reads availability when you change **Where**, the public page narrows times by the
  client's In person / Online choice, room assignment warns against *in-person* hours only (a room
  is not for video), and hybrid asks for in-person availability because the counsellor holds a
  room. Enforced server-side in `createAppointment`, not just hidden in the UI. Migration 0068
  (`counsellor_availability.mode`).
- [x] **Counsellors keep their own hours** *(2026-08-10, batch 2n)*: `/app/settings` gained the
  same editor, so a counsellor updates their own availability instead of asking an admin. The
  practice keeps oversight: every save rings **every org admin's bell** and lands on the hub
  activity feed as *Counsellor availability updated*, with the counsellor as the actor.
- [x] **Profile pictures** *(2026-08-10, batch 2n)*: a member uploads their own photo (PNG / JPG /
  WebP, 3 MB) through the same presign → PUT → scan pipeline as the org logo; it counts against the
  practice's storage and replacing one releases the old bytes. It shows in the header, the team
  roster, the member page and their own settings, with coloured initials as the fallback. Served
  through `/api/avatar/[userId]`, which redirects to a short-lived signed URL only for someone
  signed in and sharing that practice, so no bucket is public and no signed link is threaded
  through pages. Migration 0068 (`team_profiles.photo_key/photo_bytes`) + 0069 (one profile row
  per member per practice - both writers were select-then-insert).
- [x] **Storage calls are bounded** *(2026-08-10, batch 2n)*: every Supabase storage call now
  carries an 8s timeout. An unreachable storage host used to leave the person watching a spinner
  until the platform default gave up; now they get an honest error in seconds. Found while proving
  the photo upload: this machine cannot resolve the configured Supabase project, so the byte hop
  itself is unproven locally - everything either side of it is.

- [x] **Storage backend is a choice: Supabase or Amazon S3** *(2026-08-10, batch 2o)*: the
  super-admin picks the backend in /admin/integrations, configures it, tests it and switches it on;
  the other backend keeps its stored credentials so switching back costs nothing. S3 sits behind
  the same `StorageProvider` seam as Supabase, presigned with SigV4 in-process (no SDK), private
  bucket, short-lived signed URLs only, and an optional endpoint for S3-compatible stores
  (MinIO, Cloudflare R2). Usage still counts against each practice's storage allowance, unchanged.
  Crucially, **switching never orphans a file**: documents already recorded their backend, and
  onboarding uploads, org logos, profile photos and chat attachments now do too (migration 0070),
  so reads follow the backend an object was written to while writes use the active one. The card
  also gained proper `aria-label`s - its fields were unlabelled for screen readers. SigV4 is
  covered by 7 unit tests that recompute the signature independently from the AWS spec; a real
  AWS round-trip is unproven here (this machine resolves no `*.supabase.co` or AWS host).

- [x] **Companies moved in with the clients; Supervision reads Classroom** *(2026-08-10, batch 2p)*:
  a company IS a client (an employer paying for its staff), so it no longer needs its own place in
  the sidebar. It opens from a **Companies** button carrying the count, sitting on the far right of
  the Clients status-filter row, with an **All clients** link back. The rail entry is gone but the
  page is not hidden: a new `paletteOnly` nav flag keeps it in ⌘K search while dropping it from the
  sidebar and mobile bar. Separately, the org's **Supervision** rail entry now reads **Classroom**,
  which is what that page actually holds; the counsellor's own **Supervision** keeps its name,
  because theirs really is supervision (their supervisor, sign-off, feedback).

- [x] **The client export is the system's export** *(2026-08-10, batch 2q)*: the POPIA
  data-subject export on a client profile was a hand-rolled JSON download - the one place in Phila
  that did not use the shared Export dropdown, and a file most people cannot open. It now goes out
  as **CSV / Excel / PDF** through the same menu as every other list, flattened to
  **Section · Record · Field · Value** so nothing is lost: every section, every record, every
  field, with nested structures kept verbatim and retention plus provenance closing the file.
  `ExportMenu` gained an optional `getTable` for cases where fetching the rows is itself the
  audited act, so the `dsar.export` audit row is still written before any data leaves, and only
  when someone actually picks a format. Two fixes rode along: the menu now opens **upwards** when
  the button sits low on the page (it was rendering off-screen, and scrolling to reach it closed
  it), and field names read as sentences rather than camelCase columns. 9 unit tests cover the
  flattening, including that `false` and `0` survive and that a person with nothing on file still
  gets a real file.

- [x] **A folder per counsellor, and document search** *(2026-08-11, batch 2r)*: every counsellor
  now has one folder, named after them, under a single **Counsellors** folder and shared with them
  from the moment it exists. New counsellors get theirs on creation; **Counsellor folders** on
  `/hub/documents` catches everyone who joined before (idempotent, so it doubles as repair).
  Sharing routes into it: a file or link sent to one counsellor moves into their folder (client and
  session files stay where they belong), sent to several it stays put and still reaches each of
  them. The share **note** - "open this, fill it in, send your link back" - now travels with files
  and links, not just folders, and shows under the item wherever the counsellor meets it. A
  submission rings every org admin's bell with who, what and where. Documents are searchable across
  every folder at once, each hit showing the folder it lives in. Migration 0071
  (`document_folders.counsellor_id`, `document_shares.note`).
  Three fixes found while proving it: **document shares are keyed by counsellor id**, and the new
  folder share was writing the user id, which would have hidden every counsellor's own folder from
  them; a file both placed in a counsellor's folder and shared directly **listed twice** in their
  view; and **Add link** had no submit guard, so a double click created the document twice. The
  link dialogs also had no accessible labels.

- [x] **Responsive, measured rather than eyeballed** *(2026-08-11, batch 2s)*: two specs now hold
  the line - `responsive-overflow` walks 47 pages across every role at phone (390px) and tablet
  (820px) and fails naming the widest offending element, and `responsive-details` checks the things
  a scroll test cannot see: that pages actually rendered, that dialogs fit with their buttons
  reachable, that portaled menus land on screen, and that wide tables scroll inside their own box.
  Fixes from the sweep: the **Export dropdown and row menus** were rendering off the left edge on a
  phone (now clamped, and they flip upwards near the bottom); **Insights** truncated its stat
  labels to "2 S…" and its revenue to "R" (labels wrap, the value shrinks a step, the trend chip
  takes its own line); and the **calendar opens in Agenda on a phone** instead of a seven-day grid,
  while a desktop still opens on Week and a manual choice always wins.
  It also turned up a bug that had nothing to do with layout: `getClientDossier` returned null when
  a client had **no primary counsellor**, so every unassigned client 404'd - **27 of 41 clients** in
  the demo practice could not be opened from the list they appear in. The dossier now treats an
  unassigned client as normal ("No counsellor assigned yet") and Reassign works from there.

- [x] **EAP: the practice books, from an intake form** *(2026-08-11, batch 2t)*: an employer can
  now choose **who books**. *Employees book themselves* is the original flow, untouched. *The
  practice books* turns the employee link into an **intake form**: the person fills it, becomes a
  real client linked to that employer with the fee set to **Waived (company retainer)**, their
  answers land on their record, and they join the **waitlist** for the practice to book. The link
  already shared keeps working - it redirects to the form - and self-booking with that token is
  refused server-side, so the choice is real rather than decorative. Matching an existing client is
  by **email only**: colleagues share a switchboard number, and merging two people would be worse
  than creating one twice. Every completion rings the org admins' bell.
  The **waitlist finally has a home**: a Waitlist button beside Companies on Clients opens a page
  showing who is waiting, for which employer, how long, and their answers, with Book (the ordinary
  prefilled modal) and remove. The company page gained a practice-only **Employees** section with
  the same Book button; the employer's own reporting stays aggregate and never names anyone.
  A form-level toggle, **everyone who completes this joins the waitlist**, does the same thing
  without an employer. Both switch the waitlist feature on rather than filing people somewhere
  nobody can see, and the page still opens when the feature is off so nobody already waiting
  disappears. Migration 0072 (`companies.booking_mode` + `intake_form_id`,
  `forms.waitlist_on_submit`, `form_assignments.company_id`).
  Accessibility, again: the company dialogs and the custom `Select` had no accessible names, so
  the fields were invisible to a screen reader (and untestable). Both fixed.

- [x] **Messages: live without realtime, plus the unread badge** *(2026-08-11, batch 2u)*: the
  chat's live delivery rides Supabase Realtime, and when that host is unreachable (as on this
  machine - the project's DNS is dead) the old behaviour was a console full of WebSocket errors
  and replies that only appeared on a hard refresh. Now the presence channel's status is the
  health signal: not SUBSCRIBED means the view **polls every 5s**, merging new messages by id on
  top of what is shown (an optimistic send is never clobbered, unread respects the open thread),
  and after 3 socket failures the client disconnects instead of retrying forever. Realtime still
  wins when it works; polling pauses in hidden tabs.
  The **Messages nav item carries an unread count**: seeded server-side on first paint
  (`unreadMessageCountDb`), repolled every 30s and on tab-focus, cleared on landing on Messages.
  On a phone, where Messages folds into **More**, the More tab aggregates the badges of everything
  inside it and the sheet's Messages row shows its own number - a count that only existed on a
  hidden surface wasn't a count at all.

- [x] **Edit an appointment in place** *(2026-08-11, batch 2v)*: changing what a session IS -
  service, counsellor, where, room, duration - used to mean cancel-and-rebook. The detail modal
  now has **Edit**: one panel, availability-aware (the counsellor list re-asks who works this slot
  the way the session will happen, per 2n), with the series scope **This session only / Update all
  following** applied in a single statement so nothing is cancelled or recreated. Guards match
  booking: a room is required off-line, online clears it, the DB's overlap constraints still
  apply (slot-taken surfaces as the usual message), and a counsellor can edit only their own
  session and never hand it to a colleague. Notifications stay honest: there is no "details
  changed" email template, so the client hears **in-app** only when HOW they meet changed, and a
  newly assigned counsellor always hears. Reschedule (date/time) and Cancel keep their own inline
  scope flows - moving in time is a different decision from changing substance, and the exclusion
  constraints check them differently. Wired on both the calendars and the dashboard's
  appointment modal.

- [x] **Appointment modal polish** *(2026-08-11, batch 2w)*: the parked "View client" footer is
  gone (the client's name opens their record); the action chips - Edit, Reschedule, the status
  marks, Cancel, and Open session where it applies - now live in the footer, and they step aside
  while a sub-panel is open so its **Back** button and confirm are the only choices on screen.
  Back returns to the actions without closing the modal or touching the booking. The series scope
  became two real radio circles instead of pill segments that read as more buttons, and the Edit
  panel's counsellor field now uses the shared searchable people-picker (avatars + search),
  still filtered to who is available for that slot in that mode.

- [x] **Archive-with-cancel now unassigns the leaver's clients** *(2026-08-11, batch 2x)*:
  offboarding already existed and was solid - Archive member offers "move everything to a
  successor" (clients + every future session, clash-skipped rather than failing) or "cancel their
  upcoming sessions", and nothing is ever deleted (HPCSA). But the cancel path's copy promised
  the clients would stay on the books *unassigned*, while the code left them pointed at the
  archived counsellor. `unassignCaseloadDb` now frees them for real - safe since 2s made an
  unassigned client a first-class record - and the archive summary says so.

- [x] **Request a document from a counsellor** *(2026-08-12, batch 2z)*: the Request dialog
  gained a toggle - **A client** (their portal, as before) or **A counsellor** - each with the
  searchable people-picker. A counsellor request rings their bell, appears on their Documents page
  as a "Your practice needs a document from you" card, and its **Upload** button runs the same
  presign → PUT → confirm pipeline as everything else, landing the file in **their own folder**,
  flipping the request to fulfilled and notifying the org admins by name. Server-side the request
  must be theirs and still pending; storage quota and the malware scan apply; a failure leaves the
  request open for a retry. Migration 0073 (`document_requests.counsellor_id`, `client_id` now
  nullable) - a request targets exactly one of the two.

- [x] **One people-picker everywhere** *(2026-08-12, batch 3a)*: a sweep found four dialogs still
  using the plain dropdown for choosing a person - Documents' "Assign to client", Add client's and
  Edit client's primary counsellor, and Add-to-waitlist's counsellor preference. All four now use
  the shared searchable people-picker (avatars + search) that booking, sharing, offboarding and
  the Request dialog already use. Sentinel options like "Any counsellor" wear the group icon
  rather than pretending to be a person's initials.

- [x] **The Documents selection bar pins to the screen** *(2026-08-12, batch 3b)*: selecting a
  file showed the Assign / Download / Share / Delete bar at the bottom of the CONTENT, so on a
  long page you had to scroll to find it. Root cause: the `rise` entrance animation's
  `animation-fill-mode: both` left a computed identity transform on the page wrapper forever, and
  any transform - identity included - silently turns descendants' `position: fixed` into
  absolute. The fill mode is now `backwards` (same visuals: hidden during the stagger delay,
  natural style after), which frees every fixed/sticky descendant app-wide, and the bar is also
  portaled to `<body>` so no future ancestor effect can capture it again. It sits above the
  mobile tab bar via a safe-area offset. Proven by measurement: bar bottom 700 of a 720px
  viewport, unchanged after scrolling 600px.

- [x] **Edit client no longer silently assigns the unassigned** *(2026-08-12, batch 3c)*:
  chasing a reported "something went wrong" on a client edit (not reproducible - every one of the
  43 dossiers opens clean, and edit → save → reopen passes on both an assigned and an unassigned
  client; the likely cause was a dev-server restart mid-click), the probe caught a real bug in
  that dialog: it seeded the counsellor field with `initial ?? counsellors[0]`, so saving ANY edit
  on an unassigned client quietly handed them to whoever sorted first. The field now seeds with
  what IS, offers an explicit **Unassigned** option (group icon), and the action + write accept
  null. Creating a client still requires an assignment - only editing respects the unassigned
  state (first-class since 2s). Proven by DB assertion: a phone tweak leaves
  `primary_counsellor_id` untouched for both kinds of client.

- [x] **The waitlist closes its loop** *(2026-08-12, batch 3d)*: booking someone off the waitlist
  used to leave them marked "waiting" everywhere except the old Appointments card. Now
  `placeWaitlistForClientDb` runs inside EVERY booking path - the hub modal (which the waitlist
  page, calendar and company tab all share) and public self-booking - so a session anywhere flips
  the entry to *placed* with a timestamp and no surface has to remember. The waitlist page grew
  **Waiting / Booked** tabs with counts, avatars, employer chips, and richer rows: a booked person
  shows *Booked <date>* plus *Next session <when> · <counsellor>* (Book/remove stay on waiting
  rows only), and placed entries age out after 90 days. The company profile's Employees list
  agrees the moment it happens: *Waiting* becomes **Booked · <date>**. Proven live end to end:
  a waiting employee booked through the modal moved tabs, the DB entry read placed with a
  timestamp, and the employer page swapped chips - all from one booking.

- [x] **The waitlist shows the answers, in place** *(2026-08-12, batch 3e)*: clicking the intake
  title on a waitlist row used to open the public fill link, which tells a completed response
  "already submitted" - nothing useful. The row now opens their actual answers in a dialog
  (the same ResponseView the dossier uses), with the person's name and employer in the header
  and a **Book <name>** button in the footer, so read-then-book is one motion. The query carries
  the latest completed response's fields + answers instead of a dead-end token.

- [x] **Company documents: one folder, two doors** *(2026-08-12, batch 3f)*: every employer now
  has a folder under **Documents → Companies**, created with the company, ensured (and healed)
  on every profile visit, and renamed when the company is renamed. The company profile gained a
  **Documents** card that IS that folder - the list, Upload and Add link filing straight into it -
  and **Open in Documents** deep-links the manager already inside the folder via a new `?folder=`
  parameter. Company folders wear the building icon in the tree, as counsellor folders wear the
  people icon. Migration 0074 (`document_folders.company_id`).

- [x] **Client folders on demand** *(2026-08-12, batch 3g)*: the Documents toolbar gained
  **Client folder** - a dialog with the searchable client picker, Create for one (opens the new
  folder; a repeat says "already has a folder" and just opens it), or **Create for all** with an
  honest count of created vs already-there. Folders live under **Documents → Clients**, wear the
  person icon, and `insertClientUpload` now files a client's request-upload into their folder
  automatically, creating it on the spot if missing - covered by an integration test, since the
  filing happens at insert time, before storage is even reached. Completes the trilogy:
  Clients / Companies / Counsellors, one pattern.

- [x] **One Create-folder dropdown** *(2026-08-12, batch 3h)*: the Documents toolbar's three
  folder buttons collapsed into a single **Create folder ▾** menu in the Export-button style -
  Empty folder / Client folder / Counsellor folders, each with a one-line hint, portaled and
  edge-clamped like every other menu.

- [x] **Real-intake template + Edit is org-only** *(2026-08-12, batch 3i)*: checked the Full
  intake template against a real counselling organisation's Google-Forms intake and closed the
  gaps - **date of birth** (replacing a bare age number; retention runs on DOB), **counsellor
  preference (language and/or religion)**, **session mode (online / in person)**, and a free-text
  reason alongside the what-brings-you checklist. Separately, editing a session's substance is now
  **org-only**: the Edit chip shows only on hub surfaces (a new `canEdit` flag threaded through
  the calendar and dashboard), counsellors keep reschedule/cancel/status marks, and the server
  refuses a counsellor's edit outright - defence in depth, not just a hidden button.

- [x] **Submission emails, in the org's words** *(2026-08-12, batch 3j)*: every form gained an
  **Emails** tab - a toggle, recipients (empty = every practice admin), and an editable subject +
  body with `{name}` `{form}` `{practice}` `{date}` tokens rendered at send time (pure, unit
  tested, defaults when blank, capped lengths). Every completion path runs through the public
  submit action, which now sends via the existing Resend transport - best-effort, bounded at 4s,
  never blocking the respondent's thank-you. The respondent's name resolves from the assigned
  client, the share-response name, or the answers themselves. Migration 0075
  (`forms.notify_on_submit`). Honest caveat: a real delivery needs the Resend integration live;
  the transport is the same one booking confirmations already use.

- [x] **The invoice board grows up** *(2026-08-14, batch 3k)*: the invoicing page had totals and a
  flat table - no way to view, edit or take an invoice off the books. Now: status tab pills
  (**All / Unpaid / Overdue / Paid / Cancelled**) with live counts filter the table while the stat
  tiles keep reading the whole book; client rows carry avatars and an Issued column; and every row
  has a ⋮ menu - **View invoice** everywhere, plus **Edit** (service, amount, due date in a
  dialog), **Copy pay link**, **Send reminder** and **Cancel invoice** on unpaid rows, and
  **Reinstate** on cancelled ones. Deliberate rules, enforced server-side with honest refusals:
  a paid invoice can be neither edited ("money has moved against it") nor cancelled ("refund it
  through your gateway instead"), and delete does not exist - a cancelled invoice stays on the
  books (HPCSA records rule) and can be reinstated any time. Edits, cancels and reinstates all
  land in the audit log. Proven live end to end: edit changed service + amount in the DB, cancel
  moved the row to the Cancelled tab, reinstate brought it back, mark-paid stripped the row down
  to view-only.

- [x] **Appointment references + the invoice builder gets real** *(2026-08-14, batch 3l)*: every
  session now answers to a short booking reference (`APT-3F9A2C`), derived from the appointment id
  like a git short-sha - no migration, and every past session already has one. It shows on the
  appointment modal (copyable), rides on every booked / rescheduled / cancelled / reminder /
  no-show message (appended at the single deliver() chokepoint, or placed wherever a custom
  template puts the new `{reference}` token; email subjects carry it too), and is searchable:
  ⌘K recognises a typed ref and jumps straight to that session's open modal via
  `/hub/appointments?ref=...` (works on the counsellor calendar too). On invoicing, the A4 sheet
  finally has true A4 proportions (210x297 silhouette, footer pinned to the bottom), the builder's
  **Create invoice** actually creates the invoice (server-allocated number, audited - the old
  Send button only toasted), and a searchable **Link a session** picker attaches the session an
  invoice bills: client aligns, the line prefills from the session's service, the ref prints on
  the sheet and the board searches by it. Double-billing a session is refused with the existing
  invoice's number. Proven live end to end; 7 new unit tests (reference derivation, forgiving
  parse, notification append).

- [x] **Org dashboard: Rooms promoted, Needs attention retired** *(2026-08-14, batch 3m)*: the org
  overview's "Needs attention" card came off - safeguarding flags and pending credentials are
  acted on where they live (the client profile shows the flag; Team shows credentials), and the
  dashboard reads calmer as a clean 2x2. **Rooms right now** took the fourth slot and got a
  proper design: a segmented occupancy strip (one segment per room, lit in the room's colour
  while a session is in it), bordered room rows naming the counsellor in the room, an
  In session / Free chip with the until / next time, and a View all link to Rooms. The
  dashboards e2e spec now asserts the flag on the client profile instead. The counsellor
  dashboard's own attention card is untouched.

- [x] **Dismissible page notices** *(2026-08-14, batch 3n)*: the banner notices (unbilled
  sessions on Invoicing, the verification nudge, the duplicate-clients review strip) each gained
  an **X** via one shared pattern (`useNoticeDismissed` + `NoticeDismiss`). Dismissal is
  session-scoped on purpose: these banners state standing facts - money unbilled, records to
  merge - so closing one clears it for this browser session and it returns next visit rather
  than being permanently mutable. The dedupe strip was restructured so the X isn't a button
  nested inside a button.

- [x] **One title, one place** *(2026-08-14, batch 3o)*: every page used to say its name twice -
  once in the top bar (with the date) and again as a big heading in the body. Now the shell owns
  a head slot: PageHead pushes its title + one-line description up into the top bar (the
  description replaces the date line; the date shows only when a page has no description) and
  keeps just its action buttons in the body. One mechanism covers all ~60 pages across hub /
  app / admin / funder / me - dashboards' greetings, detail pages' avatar titles included -
  with an in-place fallback for any page rendered outside the shell. Also fixed en route: the
  funders-crud e2e had been failing since custom DatePickers replaced native date inputs
  (2a6d729) - it now drives the real pickers.

- [x] **Share files by email + folder zips** *(2026-08-14, batch 3p)*: documents (or a whole
  folder) can now be EMAILED to a company - or anyone - as a tokenised download link. Select in
  Documents -> "Email link" (or "Email to company" on the company profile's Documents card,
  prefilled with their contact): recipient, note, expiry (7-90 days) -> the link goes out via
  the platform email (best-effort, honest about whether it sent, always copyable). The public
  page (/share/<token>) is branded and calm: the practice's name, the note, each file with a
  Download button (links open, files redirect through short-TTL signed URLs), and "Download all
  as .zip" packing everything into one archive. The zip comes from a ~100-line pure STORED-zip
  writer (no dependency; CRC32 unit-tested; archives verified with Windows Expand-Archive), and
  the same builder powers the Documents manager itself: downloading a folder or multi-selection
  now yields ONE zip instead of a tab-per-file. Safety rails: clinical documents and unscanned
  files never qualify (enforced at create AND at read), expiry is honest, every download is
  counted and audited, and eligibility is re-checked when the page is read so a deleted or
  reclassified file falls off an already-sent link. Migration 0076 (document_share_links).

- [x] **Waitlist: "No employer" chip removed** *(2026-08-14, batch 3q)*: the employer filter row
  now shows only Everyone + actual companies - people without an employer are simply part of
  Everyone, which is what the chip's zero-value filter amounted to anyway.

- [x] **Availability: "Any session" is opt-in now** *(2026-08-15, batch 3r)*: the old editor
  opened on "Any session", silently seeded it with the full practice week, and saved it along
  with whatever the counsellor actually set - so someone who added in-person mornings still
  looked bookable everywhere (exactly the trap the practice hit). Now **In person** and
  **Online** lead the editor, and the any-session base pattern is an explicit toggle, OFF by
  default: switching it on visibly copies the practice hours in (a chip appears, e.g. "Any
  session 7") ready to trim; switching it off drops it from the save entirely. Proven live:
  saving a single in-person Monday writes exactly one in_person row and nothing else. Toggles
  gained aria-labels along the way.

- [x] **Reschedule offers real slots** *(2026-08-15, batch 3s)*: moving a session used a bare
  date + time picker, so a closed Saturday could be picked off the little calendar and the server
  accepted it. The reschedule panel now works like PUBLIC BOOKING: day chips for the practice's
  open days only (a closed Saturday simply isn't there), then a grid of the times that session
  can actually move to - org hours for that day intersected with the counsellor's windows for
  that session type, minus their other bookings (the session being moved doesn't block itself).
  One computation (computeRescheduleSlots) serves the panel AND a new server-side guard on
  rescheduleAppointment, so what the UI offers and what the server accepts can never drift: any
  surface posting a time off the offered list gets an honest refusal. Surfaces without practice
  hours fall back to the old pickers (now also guarded server-side).

- [x] **Clients can't be double-booked** *(2026-08-15, batch 3t)*: the DB guaranteed a
  counsellor and a room can't be in two sessions at once, but nothing said the same for the
  CLIENT - so one person could hold overlapping sessions with two counsellors. A third GiST
  exclusion constraint (appt_no_client_overlap) closes it at the database, so every booking
  path - hub modal, public page, reschedule, series extension, two simultaneous requests - is
  covered atomically. Scoped to SCHEDULED sessions only: historical rows (completed, no-show,
  seeded demo history) are records, not reservations, and are never retroactively policed.
  The violation maps to an honest message everywhere ("This client already has a session at
  that time - move or cancel it first."; the public page says "You already have a session
  booked at that time"). Applied with npm run db:constraints; the live DB had no scheduled
  overlaps to clean.

- [x] **Wednesday-leak investigation + org-hours backstop** *(2026-08-15, batch 3u)*: the
  practice reported moving a session onto a counsellor's CLOSED Wednesday (any-session pattern
  with Wednesday off). Reproduced against the current build with the same counsellor and
  pattern: the reschedule panel offers no Wednesday times, and a calendar DRAG onto Wednesday
  is refused server-side - the leaked sessions date from the minutes before the 3s slot guard
  shipped (the audit log brackets them around the availability save). Two genuine gaps found in
  the audit and closed: (1) creating a session for a counsellor with NO availability pattern
  skipped every server check - a new pure helper (sessionWithinOrgHours, unit-tested: closed
  days, before-open, past-close, across breaks) now backstops the create action so pattern-less
  counsellors can't be booked outside practice hours from any surface; (2) the committed public
  booking e2e had been failing since the Phase 32 language step reshaped the wizard - updated
  and green, which also regression-proves the whole public path against this batch. Edit and
  change-request approval paths audited: already guarded / never move sessions.

- [x] **Go-live: the mock is gone from the live path** *(2026-08-16, batch 3v)*: the first
  fully-new org (Bophilo) exposed the last of the hybrid era - getBookingConfig was mock-FIRST,
  so any org without a demo fixture got a 404 on its public booking link (and the employer
  ?c= link with it). Now: (1) booking config is built from the DATABASE for every org - real
  services and counsellors filtered by the org's booking settings; (2) the standard public
  intake fields moved out of mock fixtures into lib/domain/intake as a product default (the
  booking submit depends on their well-known ids; an org's own intake forms drive the
  /f/<token> road, as before); (3) getIntakeForm lost its mock fallback (DB or null - never
  another org's fixture); (4) the four dead, mock-only DataProvider members (listConversations,
  listCounsellorInvoices, listIntakeStatus, getIntakeBoard) were deleted from the interface and
  the mock; and (5) the `...mockProvider` spread base itself is GONE - the compiler now proves
  every provider method has a real DB implementation. Proven live both ways: Bophilo's employer
  link redirects to their own MUNA intake form (practice-books mode), their micro-site renders,
  their direct booking page shows the org's honest "isn't open online" notice (their setting) -
  AND the seeded org's full public booking e2e (service -> language -> slot -> intake ->
  confirm -> DB rows) stays green. Also fixed en route: a JSX whitespace bug rendered
  "Bophiloarranges" on the booking-closed notice. NOTE: philasa.com runs an older build - these
  fixes reach it on the next deployment.

- [x] **Form responses download as PDF** *(2026-08-16, batch 3w)*: a completed form is now a
  document both sides can keep. One pure builder (lib/export/response-pdf, unit-tested for
  escaping, sections-as-headers, statements-never-print, quiet dashes for unanswered) renders
  the Q&A as a print-styled A4 - the same zero-dependency pattern as the table exports (the OS
  print dialog saves the PDF). Wired in three places: the org's form-response dialog
  (**Download PDF** next to Close), the waitlist answers dialog, and the client portal's
  completed forms (each row gains a PDF button; completed rows now travel with their questions
  + answers). POPIA footer on every document.

- [x] **Reschedule: back to free pickers, with an honest warning** *(2026-08-16, batch 3x)*: the
  practice lived with the 3s slot grid and asked for the old flow back - it limited them (a
  counsellor's day off sometimes IS the right day, by agreement). Reverted the panel to the
  free date + time pickers and removed the hard server guard; kept the lesson as a WARNING:
  the first click on an out-of-hours / off-pattern time says so plainly and the second click
  ("Move anyway") proceeds - the practice decides, informed. The DB exclusion constraints
  (counsellor / room / client overlap) still make impossible moves impossible. Bonus accuracy
  fix: the pickers now prefill with the session's SAST wall-clock (the raw UTC slice used to
  show a 09:00 session as 07:00).

- [x] **Times sit on the practice's clock** *(2026-08-16, batch 3y)*: the org sets hours, a
  session length per SERVICE, and an interval - so the pickable times are the grid those
  settings imply (Monday 08:00-17:00, 50 min + 10 min interval -> 08:00, 09:00, ... 16:00). A
  pure helper (practiceGridTimes, unit-tested: stepping, fit-before-close, closed days) powers
  BOTH the New-appointment modal and the reschedule panel; the grid re-steps when the service
  changes (Couples at 90 min -> 100-minute spacing), and days without practice hours fall back
  to the free time picker. SchedulingOptions carries bufferMin from the org.

- [x] **Rooms: empty state instead of a 404** *(2026-08-16, batch 3z)*: /hub/rooms had
  `if (rooms.length === 0) notFound()` - so a NEW practice literally could not open the page
  whose job is to create the first room (the seeded orgs always had rooms, hiding it). Zero
  rooms now renders the page with a calm empty state ("No rooms yet - start with a site, then
  add the rooms inside it") and the Manage sites + Add room buttons in the header, so a new
  org bootstraps itself. Proven live with Thrive (zero rooms, zero sites); the full page for
  orgs WITH rooms is unchanged.

- [x] **One practice per email** *(2026-08-17, batch 4a)*: inviting a team member whose email
  already had an account silently LINKED that existing login - so the same person became an
  active counsellor at two practices at once, and signing in landed them in whichever org came
  first (the practice hit this creating Bophilo counsellors with emails already used at the
  first org). The invite path now refuses an email that belongs to an ACTIVE or invited member
  of another practice - "They must be archived or removed there before this email can be used
  here." - and archiving at the old practice frees the email. Subtle implementation note: the
  cross-org lookup must run on the OWNER connection - the RLS-scoped one can't see other orgs'
  membership rows by design, which is exactly what made the first version of the guard blind.
  Two pre-existing duplicates surfaced to the practice to resolve by archiving.

- [x] **Team members: soft delete** *(2026-08-17, batch 4b)*: archived members gain a
  **Delete member** action - a SOFT delete: the org_members row stays (status "removed",
  HPCSA records intact), access stays revoked, and the email frees up for another practice
  (the 4a rule reads active/invited only). Deletion is deliberately offered only AFTER
  archiving, because offboarding is where sessions and clients get handed over - deleting an
  active member outright is refused with that explanation. A **Removed** tab (appears only
  when non-empty) lists them with **Restore member**. Also closed en route: the session's
  membership query never filtered status, so ARCHIVED members' memberships still resolved at
  sign-in - archived and removed memberships now grant no access.

- [x] **Forms: "Other" invites the client's own words** *(2026-08-17, batch 4c)*: any choice
  option named "Other" (or "Other (please specify)", any case) now grows a "Please specify..."
  input the moment it's picked - on single choice, dropdown AND multi-select. The answer stays
  one flat string ("Other: Sepedi"), so responses, the waitlist dialog, exports and the PDF all
  read naturally with no schema change; multi-select details sanitise the "; " separator. One
  renderer serves the public fill page, the booking intake and the hub preview, so all three
  gained it at once. Helpers unit-tested (spelling variants, detail extraction, round-trip).

- [x] **LivePhila minutes - the third credit rail** *(2026-08-17, batch 4d)*: video joins SMS
  and Email as a metered channel, with MINUTES as the unit. One pack: R950 for 26,500 minutes,
  bought through the same Paystack flow, settled to the same ledger. Metering moment: marking
  an ONLINE or HYBRID session COMPLETED consumes its booked length - idempotent per appointment
  (re-marking never double-charges), floors at zero, and never blocks care. Billing grew a
  LivePhila card (minutes left · minutes used · Low chip · the pack) and the low-balance banner
  now covers all three channels. NEW low-balance rail for everyone: crossing the channel's
  threshold (25 messages; 2,650 minutes = ~10% of the pack) raises a bell notification to every
  org admin exactly once, and hitting zero raises an urgent one - wired into the send chokepoint
  (sms/email) and the completion hook (video). Proven live: 2,680 -> complete a 50-min online
  session -> ledger -50, balance 2,630, "LivePhila minutes running low" bell, banner on Billing,
  re-mark charged nothing. NOTE: plan cards advertise included video minutes - granting those
  monthly via applyCredit is a natural follow-up when subscriptions go live.

- [x] **Low-credit notices email the practice too** *(2026-08-17, batch 4e)*: the low/empty
  crossings for all three rails (SMS, Email, LivePhila) now send an EMAIL to every org admin
  alongside the bell - same once-per-crossing discipline, bounded and best-effort via the
  platform transport. Pure composer (lowCreditEmail) unit-tested: names the channel, unit and
  remaining amount; the empty notice for video says plainly that sessions still run (care is
  never cut off), while sms/email say honestly that messages stop. Flagged, awaiting the
  practice's call: plan cards ADVERTISE included video minutes (e.g. "300 video min / mo") but
  nothing grants them monthly yet - a subscription-cycle applyCredit grant is the natural
  follow-up.

- [x] **No promised minutes + admin cash-payment grants** *(2026-08-17, batch 4f)*: the plan
  cards' "N video min / mo" promise came OFF every surface (marketing pricing, plan picker,
  your-plan card, admin plan control) - LivePhila is strictly what the org buys, worded as
  "LivePhila minutes by top-up". The existing super-admin credit granter (Resources & quotas on
  the admin org page) gained a THIRD meter: LivePhila minutes - for cash/EFT paid outside the
  system - through the same ledger (reason "grant", audited), and every grant now notifies the
  org's admins ("500 LivePhila minutes added - new balance ..."). Pricing work parked by
  agreement: 17-day free trial + two more packages to be designed with the practice.

- [x] **Messages upgrade - emoji, reactions, replies, group profile** *(2026-08-18, batch 4g)*: the
  team chat grew the things that make a group feel like a place. A built-in, dependency-free
  **emoji picker** on the composer (categorised + searchable, native glyphs); **reactions** on any
  message (quick bar on hover, chips under the bubble, one row per (message, user, emoji) in
  `team_message_reactions`, live to every member); **reply-to** with a quote above the bubble
  (`team_messages.reply_to_id`, same-thread only, tap to jump); and the **thread profile** panel
  behind the header: for a group - avatar, name, member count + created date, the full member
  list with role / online / "you" / "created the group", Shared files, and management for the
  creator or an org admin (rename in place, add members, remove a member) plus Leave for anyone;
  for a DM - the person, role, presence, shared files. Membership changes broadcast
  `thread_updated` / `thread_removed` so headers, counts and names move live for everyone (the
  polling fallback carries the same); every group change audited. Migration 0079 + RLS on the
  new table. Proven live with two signed-in members: emoji searched + sent, reply quoted,
  ❤️ then 👍 landed on both screens without reload, rename + add Aisha + remove Thabo showed
  on Nomsa's header live ("you, Thandeka, Aisha"), Nomsa left, DB + audit matched; the picker
  fits at 360 px.

- [ ] **Phase 33 - VoicePhila** *(in progress - `docs/PHASE_33_VOICE_CALLS_PLAN.md`)*:
  - [x] **33.1 Credit catalogue** *(2026-08-17)*: every purchasable bundle (SMS / Email /
    LivePhila / VoicePhila) is now a DB row the super-admin edits on Plans & billing - name,
    quantity, price, active/withdrawn, popular - with zero hardcoded prices anywhere. Org
    Billing and the purchase authority (startCreditPurchase) read the catalogue; migration 0077
    seeds the old constants plus the VoicePhila starter (1,000 min = R800, editable data).
    VoicePhila bundles stay hidden from orgs until the voice rail ships. Proven live: admin
    edited LivePhila R950 -> R990, org Billing showed R990 immediately, change audited, price
    restored.
  - [x] **33.2/33.3 Admin rail + adapter seam + metered webhook** *(2026-08-17)*: VoicePhila ·
    Twilio joined the super-admin Phila-platform integration cards (slug `voice`, config page
    with Account SID / auth token write-only, shared caller number, mode Off / Mock / Live, Test
    connection) - platform-keyed, orgs never BYO a voice provider. `lib/voice/` is the
    provider-swappable seam: `VoiceAdapter` (placeBridgedCall / parseWebhook / testConnection),
    a Twilio implementation (bridged call = one call to the counsellor whose TwiML dials the
    client, both legs masked by the shared number; X-Twilio-Signature HMAC-SHA1 verified), and a
    deterministic mock adapter for dev. `voice_call_legs` (migration 0078) records every leg;
    `/api/webhooks/voice` updates leg lifecycle and on COMPLETED bills ceil-per-minute against
    the org's voice balance exactly once (ledger idempotency key `voice_leg_<id>`), fires the
    low-credit bell + email, and audits as `system:voice`. Proven live: mock-mode config saved
    on the admin page; a 500-second completed leg billed 9 minutes (1000 -> 991), a webhook
    RETRY did not double-charge, and a wrong signature got 403. Dormant by default - no org
    surface exists until 33.7.
  - [x] **33.4-33.7 Bridged call engine + in-session panel + org Voice card** *(2026-08-17)*:
    "Call client" now lives on the session (session editor + the appointment modal on every
    calendar/dashboard surface) - it dials the COUNSELLOR first, then bridges the client, both
    masked by the shared number; each attempt is its own logged leg with redial after a drop,
    and the panel shows live state (dialling / ringing / connected), the attempts list, and the
    system-measured running total. Honest hard stop BEFORE dialling: no dialable client number,
    no counsellor number on the profile, or a zero minute balance names its reason - a broken
    call can never place (`toE164` normalises SA numbers; garbage refuses). A completed call
    AUTO-records "Held by phone" on the appointment with the carrier-measured total minutes -
    the manual entry stays for calls made outside the platform. Org Billing gained the fourth
    card: VoicePhila minutes (balance, used, low nudge) with bundles from the admin catalogue -
    all of it appearing only once the platform voice rail is on. Proven live: Nomsa placed a
    mock call from her session, the webhook completed it at 430 s -> billed 8 min (1000 -> 992),
    the panel showed "7m 10s · billed 8 min" + total, the header wore "Held by phone · 8 min",
    zero balance disabled Call again with the top-up reason, and Billing showed 750 min + the
    R800 bundle. 292 unit tests green. Per-org dedicated number (33.8) stays deferred.
    *Polish (same day, practice feedback)*: the minute balance is org-admin-only - a counsellor
    sees just "Phone the client on the practice number." + the button (the out-of-minutes reason
    tells them to ask their admin); the panel wraps cleanly at 360 px, no horizontal scroll.
    Original scope line: bridged counsellor-to-client phone calls on a shared masked number,
  system-measured minutes as the FOURTH credit channel (`voice` beside sms/email/video), Twilio
  first behind a swappable adapter so other providers can be switched on/off later; includes the
  admin credit-pricing catalogue that un-hardcodes ALL pack prices (SMS/Email/LivePhila too).

- [ ] **Phase 34 - Client messaging + the WhatsApp nudge + WhatsApp rail v2** *(planned 2026-08-18 -
  `docs/PHASE_34_CLIENT_MESSAGING_WHATSAPP_PLAN.md`)*: practice ↔ client conversations inside Phila
  (the practice speaks first; the client's Messages menu appears only then; reply but never start;
  text + emoji only), a presence-aware "X sent you a message on Phila - open it" nudge over the org's
  own WhatsApp number (SMS/email fallback, once per thread until read, quiet hours + opt-out, no
  message content ever), and the WhatsApp rail hardened with the Thola lessons (number health +
  throttle + banner, jittered retry + masked dead letters, webhook idempotency, never-regress delivery
  ticks, Meta-approved template modelling) plus a proper Hub → Settings → Integrations home for the
  connection.
  - [x] **34.1 Client conversations** *(2026-08-18)*: `message_threads.kind = "client"` + `client_id`
    (migration 0080, one thread per client via the pair key). The practice speaks first - **Message**
    on the client page (Hub + counsellor app) and **Message client** on the appointment modal open
    THE conversation and land on it (`?t=` deep link). Practice-side membership is derived by role /
    caseload and self-heals on every list (org admins + front desk see every client thread, a
    counsellor their own caseload, no migration when staff change); the client's login joins when
    they activate. Staff see client threads with a **Client** chip + a **"<name> can read this
    conversation"** banner and a client-aware composer note; the client's space grows a **Messages**
    menu only once a thread exists (server-gated), a single full-width conversation with the
    practice - staff named, "Your care team" in the info panel, reply / emoji / react / quote, **no
    attach, no new, no manage**; a staff message rings the client's bell. Server rules: a client can
    only send into their own thread (never start, never address a person, never attach); direct
    staff threads refuse a client login; opening the client's Messages logs `pii.read`. Proven live
    with three signed-in browsers (admin, client, counsellor): no menu → thread opened from the
    client page → menu appeared → client replied with a quote → admin + counsellor saw it → care
    team listed → membership / audit rows matched → 360 px clean. 292 unit tests green.
  - [x] **34.2 Presence + the "you have a message on Phila" alert** *(2026-08-18)*: the shell now
    heartbeats every 60 s while a tab is visible (`user_presence`, "online" = seen < 2 min - the
    server truth for "don't ring someone who's already here"). After any message persists, every
    other member gets the **bell** (once per thread until they read it - `thread_members.nudged_at`,
    cleared on read; opening a thread on arrival now moves the cursor too) and, only when **offline**,
    ONE external alert over the same `deliver()` chokepoint every client notice uses: new trigger
    `new_message` (system + org-editable templates for WhatsApp / SMS / email; preview knows
    `{senderName}` / `{link}`), the org's WhatsApp number when connected (free in-window, approved
    template outside), else SMS / email from credits; opt-out, quiet hours and metering apply; the
    alert **never carries the message**, only "X sent you a message on Phila - open it" + a deep
    link (`/hub|/app/messages?t=` by role, `/me/messages` for clients, the activation link for a
    client with no login yet - once, until they activate). Settings → Notifications gained **Message
    alerts** (staff on/off, clients on/off; migration 0081). Every attempt lands in `message_log` +
    audit (`message_alert_<channel>_<status>`). Proven live: one honest SMS-lane alert (BulkSMS not
    configured → "dormant"), no second alert before read, heartbeat + read re-armed, a client reply
    belled online Thandeka only and alerted offline Nomsa, an online client got the bell with no
    external row. 298 unit tests green (6 new: presence boundary + alert rules).

- [ ] **EAP companies - deferred next steps** *(parked until decided)*:
  - [ ] A company **self-serve portal** (same pattern as the funder portal): HR signs in and sees
    their own aggregate dashboard - balance, usage, months - still never an identity.
  - [ ] **Low-balance nudges** to the org when a company's remaining retainer runs low (banner +
    in-app notification, like the credit top-up nudge).
  - [ ] **Seed a demo company** (with a linked employee + usage) so the story shows on the demo
    caseload out of the box.

---

## 🔒 PHASE 19: TRUST, SECURITY & POPIA HARDENING
*Goal: be allowed in the room with the most sensitive data there is.*
- [ ] **Data residency:** migrate Postgres to an SA region (AWS `af-south-1` / Azure SA North) on the `db/client.ts` swap; confirm storage + AI inference residency posture; document cross-border flows.
- [~] Field-level encryption **live** (Phase 10); **security headers done** + **per-IP auth rate limiting done** (W2); a **shared-store (Upstash) rate limiter** for the public non-auth surfaces + an observability skeleton remain.
- [x] **DPIA**; data-subject tools (export / erasure) wired to real soft-delete + pruner cron; retention policy + breach log. ✅ *(delivered by Phase 31 - DSAR export/erasure, HPCSA retention clocks + report-only pruner, s22 breach register, DPIA in `docs/compliance/`)*
- [ ] **Opt-out / DMA registry** screen before any marketing send (per the SA direct-marketing registry; manual suppression-list import until the API is published); block + audit if registered.
- [x] One-click **POPIA pack** per org  ✅ *(Phase 31 - `/reports/popia`, assembled from live consent/audit/retention/breach records + the s72 sub-processor chain, fail-strict audited on generation)*

---

## 🧪 PHASE 20: TESTING & QA
*Goal: prove the invariants that matter  isolation, redaction, consent, safeguarding.*
- [ ] Unit (scheduling, freshness, k-anon, contrast, consent state machine).
- [ ] Integration (Server Actions + Zod + RLS on a real-Postgres harness).
- [ ] E2E (Playwright) across all roles at 1280px + 360px.
- [~] **Compliance tests:** **RLS cross-org isolation is proven** (`tests/integration/rls.test.ts`, `rls-scoped.test.ts`  a query scoped to org A cannot read org B through the `phila_app` role) and a funder is scoped to its own grant. Still to broaden: no-PII-in-cross-role-payload assertions across every surface, demographic-export consent + k-anon, "AI-generated" labelling, safeguarding-never-auto-actions.

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
- [x] **Waitlist auto-fill** ✅ *(W7)*  a cancelled slot offers itself to matching waiting clients via the
  messaging rail + an in-app notification; the counsellor is told how many were offered it (`waitlist_entries`).
- [x] **Sliding-scale / subsidised fees** ✅ *(W7)*  per-client fee policy (standard / sliding-% / fixed /
  waived) flowing into the auto-invoice at booking (`clients.fee_policy`).
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
(`note_draft|care_plan_draft|extraction|summary`), `theme` (stored `light|dark`  the UI ships those two per `DESIGN.md` §10; `system` is reserved for later).

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

*Last updated: 2026-08-06 · Version 1.4 · Phila · philasa.com · Stack: Next.js · Neon · Better Auth · Supabase Storage · LiveKit*
