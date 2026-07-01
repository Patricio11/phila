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
- [x] **2 · Library + builder + preview** — nav Intake→**Forms**; `/hub/forms`
  (card grid + archived section + empty state); `/hub/forms/new` + `/hub/forms/[id]/edit`
  (`FormBuilder` — kind selector + starter templates); `/hub/forms/[id]`
  (`FormDetail` — Questions/Preview tabs); shared `components/forms/form-fields.tsx`
  (now also powers booking intake + the hub preview); `saveForm`/`duplicateForm`/
  `setFormArchived` actions; `/hub/intake` + `/hub/intake/form` redirect to `/hub/forms`;
  removed the superseded `intake-tracker`/`intake-form-editor`/intake actions.
- [x] **3 · Send + responses** — `SendFormModal` (searchable client multi-select +
  select-all), `sendForm` action → `sendFormToClients`, Responses tab (stats + list +
  View answers via the shared response dialog) with a Send button, `form_sent`
  notification (templates + Zod + template-manager) + `lib/messaging/notify-form.ts`
  (dormant-by-default; builds the `/f/<token>` link). Re-seeded the `form_sent` templates.
- [x] **4 · Client fill** — public `app/f/[token]` route (no login) → `FormFillView`
  (shared renderer + reused `intakeErrors`) → `submitForm` (server re-validates required
  fields against the snapshot); calm confirmation + invalid/already-submitted states;
  SADAG crisis line. `/me/forms` portal + `clientNav` entry.
- [x] **5 · Form Designer + share link** — a **Design** tab (`FormDesign`) in the
  builder: layout (form-only vs form + hero panel that stacks on mobile), editable
  hero heading/subheading/bullets/footnote, background (gradient / solid colour /
  uploaded image counting against org storage; image fit cover/contain + colour
  overlay & opacity) with a live preview. Themed two-pane rendering on `/f/<token>`
  via shared `form-theme.tsx` (server resolves the image to a signed URL). An **open
  share link** anyone can fill (`FormShare` toggle + copy) — a share submission
  creates a fresh response row (no client). Migration `0026`: `theme` jsonb +
  `share_token`/`share_enabled` on `forms`, nullable `client_id` + `respondent_name`
  on `form_assignments`. Seeded a themed split feedback form + its share link.
- [ ] **6 · Polish + docs** — optional booking-intake→assignment, refresh
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
