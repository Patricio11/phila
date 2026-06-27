# Phase 7 — Signature surfaces ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 6*

> Goal: the cross-role surfaces that make Phila feel like a finished, alive product.

## What shipped

### Task 7.1 — The calendar
- The custom resource-aware week calendar shipped in Phase 4 (`CalendarWeek`: week grid + agenda on
  mobile, business-hours/break shading, today ringed, status dots, **drag-to-reschedule with confirm**),
  reused for Hub oversight. Domain logic stays off the calendar surface (swap-ready).

### Task 7.2 — Create-appointment modal (used everywhere)
- A reusable **`Dialog`** primitive (modal on desktop, **bottom-sheet on phones**, scrim, Esc,
  scroll-lock, reduced-motion) + a custom **`Select`** (no native select).
- **`CreateAppointmentModal`** — client · service · counsellor · in-person/online · room · date · time ·
  duration · **recurring** · notes · send-confirmation, with inline validation and a Zod + audited
  `createAppointment` action (no message fires — honest). Wired into the **dashboard**, the **counsellor
  calendar**, and the **Hub calendars** ("Book on behalf").

### Task 7.3 — Video room shell + AI scribe
- **`VideoRoom`** — a full-screen **pre-join** (camera/mic check) → **in-session** (controls + self-PiP +
  "End & write note"), or the **paste-link fallback** when the org's in-app video is off
  (Dormant-by-Default). Mock — LiveKit wires in Phase 13. Opened from the session editor.
- The **AI-draft pipeline** (Phase 4) now also returns a **structured-extraction preview** — presenting
  issue / risk / outcome / referral, labelled "AI-extracted, feeds reporting, zero double entry".

### Task 7.4 — A4 document builder
- **`InvoiceBuilder`** — a real **A4 sheet** you type on: borderless fields, a service picker that adds
  line items, **live subtotal + 15% VAT + total**, a thin toolbar (Print / Send), and a **print
  stylesheet** (`.print-area` isolates the sheet). Fully responsive. Route `/hub/invoicing/new`, wired
  from the invoicing board.

### Task 7.5 — Outcome measures
- **`OutcomeCaptureButton`** — the validated **PHQ-9 / GAD-7** instruments in a dialog, with a live score
  + honest severity band, feeding the existing `OutcomeTrend`. The PHQ-9 safeguarding item surfaces a
  **human-first safeguarding prompt** (never auto-actioned, never names a method, SADAG line). In the
  session editor.

## New building blocks
- `components/ui/dialog.tsx`, `components/ui/select.tsx`.
- `components/scheduling/*` (modal + button) + `lib/scheduling/actions.ts`.
- `components/video/video-room.tsx`; `components/documents/invoice-builder.tsx`;
  `components/outcomes/outcome-capture.tsx`.
- A4 + print + `.print-area` isolation utilities in `globals.css`. `Label` `optional` prop (Phase 6).
- `generateAiDraft` now returns an `AiExtraction`.

## Verification
- `build` / `typecheck` / `lint` clean. New route `/hub/invoicing/new`. Total **38 routes**.
- Runtime: invoice builder renders the A4 sheet with live VAT; the session editor shows the video room
  entry (paste-link fallback when video off), the AI extraction, and the outcome capture; the
  new-appointment button is live on the dashboard/calendar/hub. No regression across all roles.

## Next — Phase 8
States + 360px responsive + motion + WCAG 2.2 AA — the demo-ready ship gate for Part A.
