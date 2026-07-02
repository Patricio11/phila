# Phase 18.7 — Client onboarding: phone-or-email, portal invite, full edit

*Status: in progress · Owner: Phila · Started 2026-07-02*

## Why

Real practices onboard clients who **don't have an email address**. Today the app
quietly assumed email: creating a client and booking both leaned on it, and there was
no clean way to invite a client to their portal by SMS or to hand them a link they can
paste into a browser. Orgs also need to **correct any detail** on a client's profile
after intake. This phase makes the client front door reflect how SA practices actually
work — **a phone number *or* an email is enough**, everywhere a client is created.

## The rule (one policy, applied everywhere)

> A client is reachable if we have **either a phone number or an email**. When both
> exist we invite by **email**; phone-only clients are invited by **SMS**. Neither is
> allowed — every client must have at least one contact.

This is enforced at **three front doors**: the hub Add-client form, the hub Edit-client
form, and the **public booking** flow (which also creates a client record).

## Scope

Because the clients feature is still **UI-first / mock** (persistence lands in
Phase 10/11 under RLS), the server actions here **validate + audit** and return
`{ ok }`; no rows are written yet. The booking client record *is* persisted (booking
is real), so the booking guard is the one that already touches the DB.

### 1. Create with phone **or** email — hub
- `createClient` (`app/hub/clients/actions.ts`): shared `contactShape` + a `.refine`
  requiring `phone || email`; message points at the phone field.
- `AddClientButton` (`components/hub/add-client-modal.tsx`): a combined `contact`
  error when both are empty; both fields flag; a helper line teaching the invite
  behaviour ("One is enough. We invite by email when there's one, otherwise by SMS").

### 2. Channel-aware portal invite + copy-paste fallback
- `inviteClientToPortal` returns a shareable `path` (`/activate?role=client&c=…`).
- `InviteClientButton` (`components/hub/invite-client-button.tsx`): default channel is
  **email when present**, else SMS, else WhatsApp; each option disabled when the channel
  isn't connected or the detail is missing. A dashed **"Can't tap the link?"** block
  shows the full URL with a **Copy** button so the org can paste it into any browser.

### 3. Full client edit
- `updateClient` (`app/hub/clients/actions.ts`): edit name, phone, email, province,
  primary counsellor, safeguarding flag; same phone-or-email refine; audited.
- `EditClientButton` (`components/hub/edit-client-button.tsx`): pre-filled modal on the
  client detail page (`app/hub/clients/[id]/page.tsx`), `router.refresh()` on save.

### 4. Booking consistency (booking creates a client too)
- Server (`app/o/[slug]/book/actions.ts`): drop the hard `phone`-required check; require
  `full_name`, `reason`, `preferred_contact`, **and** at least one of `phone`/`email` —
  the same policy as the hub, enforced where the client row is actually written.
- Client-side validator (`components/booking/validation.ts`): opt-in `contactPair`
  option so `phone`/`email` count as a single "at least one" requirement (each still
  format-checked). Exported `CONTACT_PAIR`. Generic Forms fill (`/f/[token]`) is
  **unchanged** — it passes no `contactPair`.
- Intake step (`components/booking/steps/intake-step.tsx`): render both contact fields
  as optional + a "phone or email — one is enough" hint so the required asterisk never
  contradicts what actually validates. Wizard `canAdvance` uses the pair rule too.

## Out of scope (noted for later)
- Real persistence of hub client create/edit/remove/restore/invite → **Phase 10/11**
  (RLS + consent state machine). These stay mock+audit here.
- Real per-client invite **tokens** + delivery → **Phase 12** channel rail. The copy
  link points at the existing client activation page today.

## Verification
- Gates green: `tsc`, `eslint`, `npm test` (119), `npm run build`.
- Manual: hub Add-client with phone only / email only / neither (blocked); Invite modal
  default channel + Copy link; Edit profile round-trip; public booking with email only
  (no phone) now advances and confirms.

## Checklist
- [ ] Commit — the whole phase (create phone-or-email, invite + copy link, full edit,
  booking consistency) as one green commit; plan + ROADMAP updated.
