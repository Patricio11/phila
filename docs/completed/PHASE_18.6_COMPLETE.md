# Phase 18.6  Forms: the org forms library ✅

*Shipped: 2026-07-01 · Part B · the single, mock intake form became a **real, DB-backed forms system***

> "Intake" was one hard-coded form per org, and entirely mock (no tables, `saveIntakeForm` only
> audited, "send" was optimistic UI, responses lived in fixtures). Phase 18.6 makes forms **real**:
> a library of many forms, sent to one or many clients, with responses collected  plus a beautiful,
> themeable, shareable public page. Intake is now just one form *kind*, still driving booking.

---

## Real, not mock
Two new tables (`forms`, `form_assignments`) with **RLS org-scoping** (migrations `0025`–`0026`).
`db/queries/forms.ts` does the real reads + writes; `db-provider` overrides the whole Forms surface
(mock keeps a mutable in-memory store for dev). The fixtures are **seeded into Neon**, so
`DATA_PROVIDER=db` serves identical data. `getIntakeForm` now resolves the active `kind='intake'` form
from `forms`, so booking reads the real thing.

## Response integrity by design
Every send **snapshots** the form (`{kind,title,intro,fields}`) onto the assignment. Responses always
render from that snapshot, never the live form  so editing a form can never rewrite a past answer.

## The library (`/hub/forms`)
- Card grid: kind badge, question + sent/completed counts; **create / duplicate / archive**; empty state.
- **Builder** (`FormBuilder`): a **Build** tab (questions, reorder, types, required/confidential) and a
  **Design** tab, with starter templates (Blank / Intake / Feedback / Screening) and a live preview.
- **Form detail**: **Responses · Questions · Preview** tabs. Responses shows stats + list + **View answers**
  (from the snapshot). One shared field renderer (`components/forms/form-fields.tsx`) powers the booking
  intake step, the hub preview, AND the client fill page  so "preview == what the client sees" is structural.

## Send + collect
- `SendFormModal`: searchable **multi-select** of clients (+ select-all) → each client gets their own
  unguessable `/f/<token>` link.
- New **`form_sent`** notification across WhatsApp/SMS/email (`lib/messaging/notify-form.ts`), routed through
  the Phase-12 deliver chokepoint  **dormant-by-default**, builds the link, never fakes a send.
- **Booking intake mirrors in**: every public booking writes a completed `form_assignments` row against the
  active intake form (`recordBookingIntakeDb`, best-effort  wrapped so it can never break booking), so intake
  answers show up in Responses alongside everything else.

## The Form Designer + share link (the "magic")
- **Design tab** (`FormDesign`): layout **just-the-form** vs **form + branded hero panel** (stacks on mobile);
  editable hero heading / subheading / bullets / footnote; background **gradient / solid colour / uploaded
  image** (cover·contain fit + colour overlay & opacity)  with a **live preview**. Background images upload
  through the storage seam and **count against org storage** (dormant-safe: falls back to colour/gradient).
- **Themed two-pane rendering** on the public `/f/<token>` page (`components/forms/form-theme.tsx`); the page
  resolves a background image to a short-TTL **signed URL** server-side.
- **Open share link** (`FormShare`): one public link the org can **copy / share**; anyone can fill it and each
  submission is a fresh response row ("From share link", best-effort respondent name).

## Client experience
- Public **`/f/<token>`** (no login): themed when configured, calm confirmation, invalid + already-submitted
  states, SADAG crisis line. Server **re-validates required fields** against the snapshot  a crafted request
  can't skip them. `noindex`.
- Signed-in clients see their assigned forms at **`/me/forms`** (`clientNav` entry).

## Proof
- Six green commits; **tsc + eslint + 119 tests + prod build** clean throughout.
- Migrations `0025`–`0026` + seed applied to Neon; RLS reapplied.
- Demo: Hub → **Forms** → *After your session* → **Responses** for the share link, or open
  **`/f/s_feedback_masizakhe`** (no login) for the themed two-pane page.

## Honest follow-ups
- A conditional/branching question type, and file-upload answers (fields are text-based today).
- Per-response export (CSV) and response search/filter as volumes grow.
- Scheduled/automatic sends (e.g. a feedback form N days after a completed session).

*Phila · philasa.com · Phase 18.6 · Forms library*
