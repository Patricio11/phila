# Phase 18.6 — Forms: the org forms library

**Status:** in progress · **Started:** 2026-07-01 · sits after 18.5 (Team Messaging), before 19.

## Why

"Intake" was a **single, hard-coded form per org**, and entirely mock (no tables,
`saveIntakeForm` only audited, "send" was optimistic UI, responses lived in
fixtures). Orgs actually need **many** forms — intake, feedback, screening
(PHQ-9-style), consent supplements, custom — created and managed like a library,
sent to one or many clients, with responses collected and reviewable. Phila is
going to production, so this is built **DB-backed and real**, and intake becomes
one form *kind*.

## Decisions (locked)

- The hub **"Intake"** nav becomes **"Forms"**; intake is one form (`kind: "intake"`),
  still driving booking. `/hub/intake` → redirect to `/hub/forms`.
- Clients fill via an **unguessable link `/f/<token>`** (no login, WhatsApp/email
  friendly) **and** a `/me` list for signed-in clients.
- **DB-backed** persistence (+ mock fixtures kept, and **seeded into Neon** so
  `DATA_PROVIDER=db` serves identical data).
- Shipped as a **sequence of green commits** (tsc + lint + build + tests each).

## Data model

- **`forms`** — `id, orgId, kind (intake|feedback|screening|consent|custom), title,
  intro, fields (jsonb FormField[]), status (active|archived), createdBy,
  createdAt, updatedAt`. The active `kind='intake'` form drives booking.
- **`form_assignments`** — a form sent to a client, and the response row:
  `id, orgId, formId, clientId, token (unique), status (sent|completed|revoked),
  snapshot (jsonb — form frozen at send time), answers (jsonb, null until filled),
  sentBy, sentAt, submittedAt`.
- **RLS:** `forms` + `form_assignments` added to the org-isolation array
  (`db/rls.sql`). The public token route reads via the owner connection (no org
  session), like `app/pay/[token]`; writes are scoped by the assignment's `orgId`.
- **Response integrity:** responses always render from the assignment `snapshot`,
  never the live form, so editing a form never rewrites a past answer.

## Provider seam

`lib/data-provider.ts` interface + `lib/mock/provider.ts` (fixtures, mutable store)
+ `db/queries/forms.ts` (real), wired in `lib/db-provider.ts`:

`listForms`, `getForm`, `getFormResponses`, `createForm`, `updateForm`,
`duplicateForm`, `setFormStatus`, `sendFormToClients`, `getFormByToken`,
`submitFormResponse`, `listClientForms`. `getIntakeForm` now resolves the active
intake form from `forms` in DB mode (mock fallback if unseeded).

## Delivery — commits

- [x] **1 · Data model + seam + docs** — enums + domain types (`Form`, `FormField`,
  `FormAssignment`, `FormSnapshot`; `IntakeForm`/`IntakeField` kept as aliases),
  `forms`/`form_assignments` tables + migration `0025_secret_lyja.sql`, RLS,
  `db/queries/forms.ts`, provider interface + mock + db, fixtures (`orgForms`,
  `formAssignments`) + **Neon seed**. Migration + RLS + seed applied. This doc + ROADMAP §18.6.
- [ ] **2 · Library + builder + preview** — nav Intake→Forms, `/hub/forms` (card
  grid), `/hub/forms/[id]` (Questions/Preview), `/hub/forms/[id]/edit` (builder),
  shared `components/forms/form-fields.tsx`, create/update/duplicate/archive
  actions, `/hub/intake` redirect.
- [ ] **3 · Send + responses** — `SendFormModal` (client multi-select),
  `sendFormToClients`, Responses tab + response detail, `form_sent` notification +
  `lib/messaging/notify-form.ts`.
- [ ] **4 · Client fill** — `app/f/[token]` route + submit + confirmation,
  `/me` Forms surface + `clientNav`.
- [ ] **5 · Polish + docs** — optional booking-intake→assignment, refresh
  `docs/SMOKE_TEST.md` / `docs/DEMO_LOGINS.md`, final ROADMAP + this doc marking 18.6 done.

## Verification

- Gates green every commit: `npx tsc --noEmit`, `npx eslint`, `npm run build`, `npm test`.
- Provider parity in `tests/contract/provider-conformance.test.ts` (mock == db shapes).
- RLS/isolation: a form/assignment in org A invisible to org B; a token resolves
  only its own assignment, with no session.
- E2E: hub creates a form → sends to ≥2 clients → open `/f/<token>` (no login) →
  submit → answer appears in Responses; booking renders the active intake form;
  `/hub/intake` redirects.
- DB apply: `db:generate` → `drizzle-kit migrate` (DATABASE_URL from `.env.local`)
  → `db:rls` → `db:seed`; confirm seeded forms + responses render in `DATA_PROVIDER=db`.

*Phila · philasa.com · Phase 18.6 · Forms library*
