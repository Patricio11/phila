# Phase 3 — Client portal (`/me`) ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 2*

> Goal: the client's calm home — their journey, sessions, documents, invoices, consent control, and
> the care plan their counsellor chose to share.

## What shipped

The lightest shell (DESIGN.md §5.4) with its own nav (Home · Sessions · Documents · Billing · Consent),
backed by a `requireClient` guard and the demo client identity (Lerato Mahlangu). A client **only ever
sees their own data** (Redaction matrix). Five pages:

### Task 3.1 — `/me` overview
- **Upcoming session card** with a **Join** button for online sessions (enabled only inside the
  10-minute join window; the room itself is the Phase-7 video shell). Friendly relative time
  ("Tomorrow at 10:00").
- **Recent sessions** snippet + a link to the full history.

### Task 3.2 — Records + control
- **`/me/sessions`** — the full session history as a clean timeline (Upcoming / Past), honest state dots.
- **`/me/documents`** — documents shared by the counsellor + **optimistic upload** (mock; Phase 10 stores
  to Supabase with signed URLs).
- **`/me/billing`** — invoices with ZAR amounts + status; a **Pay** action that is honest about the
  dormant gateway ("online payment isn't set up yet — pay your practice directly").
- **`/me/consent`** — the **consent centre**: view and **revoke/grant each purpose**, reflecting
  immediately (local in Part A; Phase 9 persists), each change toasted; a POPIA reassurance band.

### Task 3.3 — "From your counsellor" (care plan)
- The **`CarePlanCard`** — the *shared* artifact only (never the private clinical note,
  Care-Confidentiality Rule), and **gated behind the `care_plan_share` consent**. Summary, **tickable
  between-session tasks** (gentle, never gamified — a toast, no streaks), recommended resources
  (incl. the SADAG line), and the next step. Ticking is local in Part A; Phase 14/B persists it back.

## New building blocks
- `components/ui/toast.tsx` — `ToastProvider` / `useToast` / portal `Toaster` (mount via
  `useSyncExternalStore`, reduced-motion safe). Calm, honest, brief.
- `components/client/*` — `CarePlanCard`, `UpcomingSessionCard`, `SessionTimeline`, `ConsentCentre`,
  `DocumentList`, `InvoiceList`.
- Seam grew the client-portal methods (`getClient`, `listAppointmentsForClient`, `getCarePlan`,
  `listClientDocuments`, `listClientInvoices`, `getClientConsents`) + db stubs; `CarePlan` gained
  `resources` + `nextStep`; new `ClientDocument` / `Invoice` types + fixtures + client appt templates.
- `requireClient` guard + the demo client principal; `NavKey` gained `client`.
- Shell fix: active-item + page-title now use a general "longest matching href" rule, so `/me` (Home)
  isn't highlighted on its children and `/me/sessions` wins correctly.

## Verification
- `build` / `typecheck` / `lint` clean. New routes: `/me`, `/me/sessions`, `/me/documents`,
  `/me/billing`, `/me/consent` (all dynamic). No regression on `/app`, `/`, `/o/[slug]`.
- Runtime: `/me` shows Lerato's next session, the gated care plan with tasks, recent sessions, consent
  summary, and the open-invoice nudge; consent centre lists purposes; billing shows ZAR + statuses.
- Every PII read on the portal writes an audit row (`logAccess`); the private note is never rendered.

## Next — Phase 4
The counsellor workspace proper: calendar, caseload + client dossier, and the **session + note editor**
(live private note + mock `<AIDraft>` → sign + compose the client-facing care plan).
