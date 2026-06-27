# Phase 2  Booking & intake flow ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 1*

> Goal: a client can book end-to-end from an org page  pick, time, intake, consent, confirm.

## What shipped

A calm, 360-first **stepped wizard** at `/o/[slug]/book` (replacing the Phase-1 holding page), with a
progress thread, Back/Continue, per-step validation, and **resume** (the draft is persisted to
localStorage per org). Five steps + a success state:

### Task 2.1  Pick + time
- **Service + counsellor** step: choose a service (duration + ZAR/Enquire) and a counsellor  or
  **"Any available"** (matched to the first free counsellor). Deep-link `?service=` from the org page
  preselects. Counsellors show honest `CredentialChip`s.
- **Time** step: a calm day-strip (next open business days only) + a slot grid from the **real
  `availableSlots` engine** via a Server Action  honouring business hours, breaks, the inter-session
  buffer, and existing bookings. Loading and honest empty ("No open times on this day") states.

### Task 2.2  Intake + consent
- **Intake** step: renders the org's mock intake form (text / tel / email / textarea / radio) with
  inline validation. Resumable.
- **Consent** step: a `<ConsentField>` per purpose  **affirmative, never pre-ticked** (POPIA).
  `booking` + `notes` are required to proceed; `comms` / `demographics` / `funder_reporting` are
  optional; `ai_processing` appears **only if the org has AI on** (Dormant-by-Default = the consent
  gate). Required consents are enforced **server-side too**, not just in the UI.

### Task 2.3  Confirm
- **Confirm** step: a summary (when / service / counsellor / contact) + the lightweight-account note.
- **`submitBooking`** Server Action: Zod-validated, re-checks required consents + intake server-side,
  **audits** the consent grants and intake capture (`logAccess`), and returns an honest confirmation
  with a reference. No persistence in Part A (Phase 9/10 persists the account, appointment, intake,
  and consent).
- **Success** state: reference + details + an **honest delivery line** ("a confirmation *will* be
  sent…"  messaging is dormant, never a fake "sent"). The session would now appear on the client's
  `/me` thread (Phase 3).

## New building blocks
- `components/booking/*`  `BookingShell` (progress thread), `BookingWizard` (orchestrator, resumable),
  `ConsentField`, the five steps + success, `validation.ts`, `types.ts`.
- `components/ui/input.tsx`  `Input` / `Textarea` / `Label` / `FieldHint` / `FieldError` / `RadioGroup`
  (accent focus ring, inline validation, no native select).
- Server actions `app/o/[slug]/book/actions.ts`  `getAvailableSlots`, `submitBooking` (Zod).
- Seam grew `getBookingConfig(slug)` (+ db stub); `intakeForms` fixtures + `IntakeForm`/`IntakeField` types.

## Bug fixed
- **`isoWeekday` timezone off-by-one.** It anchored at SAST midnight, which is the previous UTC day,
  so `getUTCDay()` returned the wrong weekday (it called Monday "Sunday")  which would have closed
  open days and opened closed ones in the slot engine and room utilisation. Now anchored at UTC
  midnight. Verified with a unit test of `availableSlots` (honours hours/buffer/break/existing; weekend
  closed).

## Verification
- `build` / `typecheck` / `lint` clean. Routes unchanged in shape (`/o/[slug]/book` now the wizard).
- Slot-engine unit test passes. Runtime: the book page renders step 1 (services, "Any available",
  counsellors, progress thread); `?service=` deep-link works.

## Next  Phase 3
Client portal (`/me`): overview + session history, documents + invoices (stubs), the consent centre,
and **"From your counsellor"** (the shared care plan + tickable tasks  never the private note).
