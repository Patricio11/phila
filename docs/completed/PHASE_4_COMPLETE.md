# Phase 4  Counsellor workspace ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 3*

> Goal: the daily clinical loop  the heart of the product  fully built on mock data. AI scribe is
> **mock** here (real in Phase 14).

## What shipped

### Task 4.1  Today + calendar
- **Today** (`/app`) shipped in Phase 0 as the reference build (stat cards, the "now" line, outcomes,
  attention, the create-appointment action).
- **`/app/calendar`**  a custom, fully themeable **week grid** (desktop) with business-hours / break
  shading, **today ringed**, events carrying a quiet status dot; an **agenda day-list on mobile**.
  **Drag-to-reschedule with a confirm step** (mock `rescheduleAppointment` action  **no notification
  fires**, honest; Phase 11/12 wire the real engine + message). Domain logic stays off the calendar
  surface (swap-ready).

### Task 4.2  Caseload + dossier
- **`/app/clients`**  a reusable, sortable, searchable **`DataTable`** with status filters; each row
  shows next/last session, status (new / active / **safeguarding** / inactive), and links to the dossier.
- **`/app/clients/[id]`**  the client dossier: contact, **consent state**, **demographics only when
  consented** (otherwise an honest "not shared" lock), the **session-history timeline**, the **outcome
  trend** chart, and documents. A **`SafeguardingPanel`** (rose, points to a human + current SA support,
  never names a method) shows for flagged clients. Opening a dossier writes an audit row.

### Task 4.3  Session + note editor (the loop's core)
- **`/app/sessions`**  the counsellor's sessions list (upcoming / recent), each opening the editor.
- **`/app/sessions/[id]`**  the **`SessionEditor`**: the **private clinical note** (live, autosaving,
  never-blocking textarea, with the note-access decision enforced  author/supervisor read freely, a
  Hub read would be an audited override), the **`AIDraft`** flow ("Generate draft with AI" → a clearly
  **"AI-generated" labelled** draft → edit → **Sign**; the counsellor is author of record, AI never
  signs/sends/advances state), **mark progress** (completed / no-show / postponed  "AI never marks a
  session, only you do"), the **video-room entry** (online; the room is Phase 7), and the **care-plan
  composer**  a *separate*, explicitly-shared artifact ("your private note is never included").

### Task 4.4  Supervision
- **`/app/supervision`**  the supervisor's **sign-off queue** (honest provenance: whose note, when
  submitted); signing off is the supervisor's explicit action. Non-supervisors get a calm empty state.

## New building blocks
- `components/ui/data-table.tsx` (generic, sortable, searchable, responsive, navigable rows).
- `components/workspace/*`  `CaseloadTable`, `SafeguardingPanel`, `SessionEditor`, `CalendarWeek`,
  `SupervisionQueue`.
- `lib/domain/labels.ts` (human labels for demographic enums).
- Server actions: session (`generateAiDraft` / `signNote` / `markProgress` / `shareCarePlan`) +
  calendar (`rescheduleAppointment`)  all Zod-validated + audited; mock (no persistence) in Part A.
- Seam grew the workspace methods (`listCaseload`, `getClientDossier`, `listCounsellorSessions`,
  `getSession`, `getSupervisionQueue`) + db stubs; per-client outcomes + supervision fixtures; contextual
  note seeding (a safeguarding session carries an unsigned draft).
- `ToastProvider` now wraps the counsellor shell too; nav items Calendar/Clients/Sessions/Supervision
  are live.

## Verification
- `build` / `typecheck` / `lint` clean. New routes: `/app/calendar`, `/app/clients`,
  `/app/clients/[id]`, `/app/sessions`, `/app/sessions/[id]`, `/app/supervision` (all dynamic).
- Runtime: caseload lists the caseload with statuses; **consent-gating verified** (Lerato's demographics
  show; Sipho's are hidden with the honest lock + safeguarding panel + SADAG line); the session editor
  renders the private note, the AI-draft control, sign, and the care-plan composer; calendar + supervision
  render. No regression on `/app`, `/me`, `/`, `/o/[slug]`.
- The full **daily loop** clicks through: caseload → dossier → open session → AI-draft → sign → mark →
  the thread updates (Phase-4 "Done when").

## Next  Phase 5
The Org-admin Hub: oversight, calendars across counsellors, team & roles, rooms, intake, invoicing,
and the consent-gated demographic/funder reporting differentiator.
