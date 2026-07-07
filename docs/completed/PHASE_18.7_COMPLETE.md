# Phase 18.7  Client onboarding: phone-or-email, portal invite, full edit ✅

*Shipped: 2026-07-02 · Part B · the client front door now matches how SA practices actually onboard*

> Real practices onboard clients who **don't have an email address**. The app had quietly assumed email:
> creating a client and booking both leaned on it, with no clean way to invite a client to their portal by
> SMS or to hand them a paste-able link. Phase 18.7 makes **a phone number *or* an email** enough,
> everywhere a client is created  and makes the clients feature **DB-backed**.

---

## The rule (one policy, applied everywhere)
> A client is reachable if we have **either a phone or an email**. When both exist we invite by **email**;
> phone-only clients are invited by **SMS**. Neither is allowed  every client must have at least one contact.

Enforced at **three front doors**: the hub Add-client form, the hub Edit-client form, and the **public
booking** flow (which also creates a client record).

## Create with phone or email  hub
`createClient` (`app/hub/clients/actions.ts`) uses a shared `contactShape` + a `.refine` requiring
`phone || email`. `AddClientButton` shows a combined `contact` error when both are empty, flags both
fields, and teaches the invite behaviour ("One is enough. We invite by email when there's one, otherwise
by SMS").

## Channel-aware portal invite + copy-paste fallback
`inviteClientToPortal` returns a shareable `path` (`/activate?role=client&c=…`). `InviteClientButton`
defaults to **email when present**, else SMS, else WhatsApp (each option disabled when the channel isn't
connected or the detail is missing). A dashed **"Can't tap the link?"** block shows the full URL with a
**Copy** button so the org can paste it into any browser.

## Full client edit
`updateClient` edits name, phone, email, province, primary counsellor, and the safeguarding flag under the
same phone-or-email refine, audited. `EditClientButton` is a pre-filled modal on the client detail page,
with `router.refresh()` on save.

## Booking consistency
Booking creates a client too, so it now shares the policy: the server requires `full_name`, `reason`,
`preferred_contact`, **and** at least one of `phone`/`email`. The client-side validator gained an opt-in
`contactPair` rule (`CONTACT_PAIR`) so the two count as a single "at least one" requirement (each still
format-checked); the intake step renders both contact fields as optional with a "phone or email  one is
enough" hint so the asterisk never contradicts what validates. Generic Forms fill (`/f/[token]`) is
unchanged (passes no `contactPair`).

## DB persistence
The clients feature is now **DB-backed** (no more mock). `db/queries/clients.ts` provides `createClientDb`,
`updateClientDb`, `setClientRemovedDb` (soft-delete/restore), `reassignClientDb`  all org-scoped by
`(id, orgId)`. `db-provider` serves real `listOrgClients`, `listRemovedClients` (Removed tab),
`getClientDossier` (consents/demographics/outcomes/documents/care-plan, demographics consent-gated), and
`findDuplicateClients` (union-find over real rows). Writes are gated on `DATA_PROVIDER === "db"`, then
`revalidatePath` + client `router.refresh()` so the caseload updates live.

## Out of scope (noted for later)
- Real per-client invite **tokens** + delivery → the Phase-12 channel rail. The copy link points at the
  existing client activation page today; the invite itself is recorded to `audit_log`.
- Consent state machine on first contact (auto-granting booking/notes).

## Verification
Gates green: `tsc`, `eslint`, `npm test`, `npm run build`. Verified against Neon  a phone-only client
added via the UI wrote a real row (`email: null`, correct org + counsellor) and showed on refresh; public
booking with email only (no phone) now advances and confirms.
