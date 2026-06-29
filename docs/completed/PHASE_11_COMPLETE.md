# Phase 11 — Scheduling Engine ✅

*Shipped: 2026-06-29 · Part B · real availability, race-free no-double-booking, room utilisation, recurring series, and an offline queue*

> Goal: real availability, rooms, room-assignments, and recurring series behind
> the Part-A calendar — correct and safe, on real DB data, with no UI churn.

---

## What shipped

### Real availability
The pure `availableSlots(org, date, existing, …)` already mirrored production
(business hours, breaks, buffer, min-notice, clash). Booking now feeds it **real**
inputs: `dbProvider.getBookingConfig` swaps in the **persisted org** (admin-editable
business hours / buffer), and the clash data is the real per-counsellor DB
appointments — so changing the practice's hours actually moves the offered slots.

### No-double-booking — enforced at the database
`db/scheduling.sql` (`npm run db:constraints`): the `btree_gist` extension + GiST
`EXCLUDE` constraints `appt_no_counsellor_overlap` and `appt_no_room_overlap`
reject **any** overlapping booking for the same counsellor or room — race-free and
atomic, so two concurrent requests can't both win. Cancelled sessions don't
reserve time. The window is wrapped in an `IMMUTABLE appt_window()` (since
`timestamptz + interval` is only stable). Constraints are `DEFERRABLE INITIALLY
DEFERRED` so a whole-series shift lands in one statement. The booking / create /
reschedule actions catch the violation and return a friendly "that time was just
taken" (`db/queries/errors.ts`); `persistBooking` cleans up the orphan client if
its appointment loses the race.

### Room allocation + utilisation
- **`room_assignments`** table (org-scoped, RLS'd, seeded). In-person bookings
  **default to the counsellor's assigned room** for the slot's weekday/time, then
  fall back to first-free; multi-site aware via the assignment's room→site.
- **`/hub/rooms`** overview + detail (`getRoomsOverview` / `getRoomDetail`) roll up
  meetings, booked hours, % utilisation, busiest day, and per-day occupancy from
  **real** appointments + assignments (the pure `roomUtilisation` helper).

### Recurring series — edit-this/all
- `appointments.series_id` links a weekly series (set by `createAppointment`);
  `cancel_reason` keeps a cancellation note on the record.
- `rescheduleAppointment(id, newStart, scope)` and `cancelAppointment(id, reason,
  scope)`: `scope: "following"` acts on this + every later session. The reschedule
  shift is one UPDATE so the deferred constraints only see final, non-overlapping
  positions.
- Appointment-detail UI: a "Weekly series" badge, a **This-session / All-following**
  toggle on reschedule **and** cancel, and a cancel panel with a reason field.

### Offline send-queue (PWA)
- `lib/pwa/offline-queue.ts`: durable **IndexedDB** queue (in-memory fallback for
  SSR/tests) + a pure, unit-tested `processQueue()` — sent items removed,
  conflicts/failures kept with a surfaced status, failed retried, conflicts not.
- `lib/pwa/queue-client.ts`: replays each item against the **real** server action,
  so a slot taken while offline returns a **conflict** (never a fake "sent").
- `components/pwa/offline-indicator.tsx`: global honest pill — "Offline — N queued"
  → "Syncing…" → "Synced N" / "N need attention"; auto-flushes on reconnect.
- The booking wizard queues the booking when offline and shows a truthful
  "Saved on your device — sends when you're online" screen.

---

## Tests
- **67 unit / contract / integration** (Vitest) — incl. 4 GiST-constraint tests
  (counsellor/room overlap rejected, back-to-back allowed, cancelled frees the
  slot), 3 series tests against the real query fns (link, shift-all, cancel-all),
  and 4 offline-queue tests (sent/conflict/failed, retry, no-retry-on-conflict).
- **Playwright E2E** — room detail reflects a live booking; **a booking made
  offline queues, then syncs to a real appointment on reconnect**; plus the full
  Phase-9/10 suite. Screenshots in `/screenshots`.
- `tsc` + `eslint` clean. Migrations 0010 (`room_assignments`) + 0011
  (`series_id`/`cancel_reason`) on Neon; `db:constraints` applied.

**Done when (met):** the calendar, booking, and Hub oversight read real
availability; bookings can't double-book; rooms show real utilisation; recurring
series edit this/all; and offline bookings queue and sync.
