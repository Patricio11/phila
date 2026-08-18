# 💬 PHASE 34: **Client messaging + the WhatsApp nudge + WhatsApp rail v2**

*Goal: let the practice (org admin, front desk, the client's counsellor) message a **client** inside
Phila's messaging - the client replies in their private space but can never START a conversation -
and whenever anyone (staff or client) receives a Phila message while they're **not online**, tell
them over **WhatsApp** (the org's own number; SMS / email fallback) that "X sent you a message on
Phila - open it". Underneath, harden the WhatsApp rail with what Thola does well: number health,
retries + dead letters, webhook idempotency, delivery ticks that never regress, and a proper
Integrations home for the connection.*

> **Status:** 🔨 in progress - 34.1 shipped 2026-08-18; 34.2 next. Written after reading Phila's messaging + WhatsApp stack end to end
> and a deep read of Thola v2 (`C:\Users\patri\Downloads\thola\thola_v2` - its WhatsApp transport,
> webhook, number-health, inbox, follow-up engine and readiness docs).
>
> **What Phila ALREADY has (do not rebuild):** the org **BYO WhatsApp** connection (Meta Cloud API -
> Phone Number ID, WABA, token, app secret, verify token; encrypted; Test connection; "Help me set
> up") under Hub → Settings → Notifications; the single **`deliver()` chokepoint** routing every
> client notice by preferred channel (WhatsApp → SMS → Email), **24-hour window** logic (free-form
> inside, approved **template** outside, honest skip otherwise), **STOP opt-out**, **quiet hours**,
> `message_log`, the org **template manager**, delivery-status webhook, SMS/Email credits; the staff
> **team chat** (threads, groups, attachments, edit/delete, reactions, replies, group profile,
> presence dot via Supabase Realtime, polling fallback, unread badge); in-app **notifications** (the
> bell) with `notifyClientUser` / `notifyCounsellor` / `notifyOrgAdmins`; the client **portal**
> (`/me`, `user.client_id` links a login to a client row); the **invite-to-portal** flow.
>
> **What Thola has that Phila doesn't (worth borrowing - each cited to its file):** number-health
> events + throttle + banner (`lib/whatsapp/health.ts`, `NumberHealthBanner.tsx`), jittered retry +
> masked dead letters (`lib/messaging/retry.ts`), webhook idempotency `processed_events`
> (`lib/webhooks/idempotency.ts`), never-regress delivery ordering (`webhooks/whatsapp/route.ts:210`),
> quiet hours for business-initiated only (`automations/engine.ts:65`), the "window closed" UX triad
> (disable box → pick template → "email them instead"), copyable webhook URL + 5-step guide +
> merge-on-save + test-against-saved-creds (`OrgConnections.tsx`), after-hours auto-reply behind six
> gates (`lib/ai/autoreply.ts`), country-keyed rate card. **Thola gaps to avoid:** its lead lookup by
> phone runs BEFORE tenant routing (cross-tenant risk), its webhook always 200s (forfeits Meta retry),
> its inbox template picker sends Thola templates not Meta-approved ones, no Embedded Signup (its
> "Connect WhatsApp" modal is an admitted mock).

> ### 🧭 The design, in three lines
> 1. **Conversations live in Phila.** Clinical / care content stays inside the platform (encrypted,
>    audited, POPIA-scoped). WhatsApp is the **doorbell**, not the room: it says "you have a message,
>    open Phila" - it never carries the message body. That one decision keeps the practice's WhatsApp
>    number clean (no clinical text on Meta's servers), keeps every word inside the redaction matrix,
>    and means a client on WhatsApp still ends up in the space we control.
> 2. **The practice always speaks first.** A client thread exists only because staff opened it; the
>    client's Messages menu appears only then, and the client can reply but never start a new thread
>    or add a new person. Same rule as care plans / documents: the practice shapes the relationship.
> 3. **Nudge only when it helps.** If the recipient is online in Phila (heartbeat < 2 min), no
>    external message goes out. Otherwise: bell + ONE nudge over their preferred channel, at most one
>    per thread until they read it, quiet hours respected, opt-out respected, credits metered as
>    today. Never a duplicate, never a silent drop.

> **Guardrails:** WhatsApp stays **BYO** (the org's number, the org pays Meta; Phila never fronts a
> shared WhatsApp sender - Meta ties identity/quality/templates to the WABA) · nudges carry **no
> message content** and no client-identifying detail beyond first name of the *sender* · a client is
> **never** in a group and never sees staff-to-staff threads · client replies are **text + emoji only**
> in v1 (files go through the existing request-bound Documents flow, which is already POPIA-shaped) ·
> everything dormant until the org connects WhatsApp / has credits · honest states everywhere.

---

## Task 34.1: Client conversations in the messaging system (practice ↔ client)
*The room. Reuse `message_threads` - a third `kind`.*
- [x] **Data:** `message_threads.kind = "client"` + `client_id` column (nullable, indexed); pair key
  `<orgId>:client:<clientId>` so there is exactly ONE practice↔client thread per client (the same
  DB-guaranteed uniqueness the direct threads use). Members: the client's **user** (via
  `user.client_id`) once activated, plus practice members - the client's **primary counsellor** and
  every **org admin / front desk** of the org (membership is derived at read time for the practice
  side, so a new admin sees the thread without a migration; the client row is the only stored member).
  RLS: same org isolation; the client's reads run under `runForClient` (org-scoped) and filter
  `client_id = me`.
- [x] **Staff can start it** from three doors: the client page (Hub + counsellor app) - a **Message**
  button; the Messages page **New message → Clients** tab (searchable, only clients the person may
  see: an org admin / front desk sees all, a counsellor their own caseload); and the appointment modal
  ("Message client"). If the client has **no portal account yet** the message still saves and the
  nudge carries the **activation link** (existing invite flow) so the first thing they see after
  setting a password is the message. Honest empty state when the client has no phone/email at all.
- [x] **In the staff Messages page** client threads sit in their own **Clients** section of the list
  (below Team / Groups) with a distinct **client chip + shield colour** and a header banner
  **"The client can read this conversation"** - staff must never mistake a client thread for internal
  chat. Every staff sender is named on the client side (the client sees "Nomsa Dlamini · Counsellor").
  Reactions / replies / emoji / edit / delete / read cursor / unread badge / realtime / polling all
  reuse the 4g machinery unchanged. Attachments from staff: allowed (signed URLs, members-only, as
  today) - a share by chat is logged like a document share.
- [x] **In the client portal** a **Messages** item appears in the nav **only when a thread exists**
  (server-checked, not just hidden), landing on `/me/messages` - a single conversation with the
  practice (practice name + logo, the staff names inside). The client can **reply** (text + emoji),
  react, quote-reply; the composer has **no attach button**, no "new message", no member list beyond
  "your care team". Unread badge on the nav item; the bell gets a notification per new staff message.
- [x] **Audit + POPIA:** opening a client thread logs `pii.read` (Thola does the same on inbox open);
  every send is audited as today; the client thread is included in DSAR export + erasure (Phase 31)
  and in retention clocks; the messages never leave the org's tenant.
- [x] **Rules the server enforces:** a client cannot create a thread (`sendTeamMessage` refuses a
  client principal without an existing thread id), cannot address anyone but "the practice", cannot
  add members, cannot attach; a counsellor can only open threads for clients on their caseload; a
  removed/archived team member drops out of client threads (already true via membership).

**Done when:** an org admin messages a client from the client page; the client sees Messages appear
in their space, reads it, replies; the counsellor sees the reply in the Clients section with the
client banner; the client cannot start a new conversation or attach a file; all audited. ✅ *(2026-08-18 - proven live with three signed-in browsers: admin, client, counsellor)*

## Task 34.2: Presence + the "you have a message on Phila" nudge (WhatsApp-first)
*The doorbell. Never carries content. Never rings if you're already in the house.*
- [ ] **Server presence:** the shell sends a **heartbeat** every 60 s while the tab is visible
  (server action → `user_presence.last_seen_at`, the table already exists and is unused today);
  `isOnline(userId)` = last seen < 2 min. This is the source of truth for suppression (the Supabase
  presence dots stay for the green dot in the UI - two different jobs).
- [ ] **New trigger `new_message`** in the message templates (system default + org-editable like the
  others): *"{senderName} sent you a message on Phila. Open it: {link}"* - **no body text ever**.
  Renders through the same `deliver()` chokepoint: preferred channel among the org's enabled ones
  (WhatsApp on the org's number when live - free inside the 24h window, an approved template outside;
  SMS / email from Phila credits), opt-out + quiet hours (non-urgent - respects quiet hours; a client
  is a person too) + credit meter exactly as today. **Staff recipients** resolve phone from
  `team_profiles.phone` and email from `user.email`; **clients** from `clients.phone / email` +
  `preferredContact`.
- [ ] **When it fires:** on every persisted message (team, group, client), for each OTHER member: if
  `isOnline` → in-app bell only. Else → bell + external nudge, **once per thread until they read it**
  (a `nudged_at` on `thread_members`, cleared by `markThreadRead`); a burst of five messages = one
  nudge. Group threads: one nudge per member with the group name ("Thandeka posted in June Interns").
  Sender never nudged. Link deep-links to the thread (`/hub/messages?t=`, `/app/messages?t=`,
  `/me/messages`); for a not-yet-activated client, the activation link.
- [ ] **Message templates + Meta template:** the org's template manager gains the `new_message` row
  per channel; the WhatsApp **template-name** field applies (outside the window Meta requires an
  approved template - the org registers one like their reminder template; the plan documents the
  positional params `{{1}}` senderName `{{2}}` practiceName `{{3}}` link).
- [ ] **Org control:** Settings → Notifications gains **"Message alerts"** - on/off for staff, on/off
  for clients, and the quiet-hours already there apply. Honest states: "WhatsApp not connected - alerts
  go by SMS/email", "No credits - alerts paused" (the existing low-credit rail already bells + emails).
- [ ] **Metering + log:** SMS/email nudges consume credits with idempotency key
  `nudge_<threadId>_<userId>_<messageId>`; every attempt lands in `message_log` with trigger
  `new_message` so Recent messages on Billing shows them; dead-letter on failure (34.3).

**Done when:** Nomsa messages Lerato while Lerato is offline → Lerato's phone gets ONE WhatsApp
"Nomsa sent you a message on Phila - open it" (or SMS/email if WhatsApp isn't connected); a second
message before she reads sends nothing more; when Lerato is online in Phila nothing external goes
out; the same works staff-to-staff.

## Task 34.3: WhatsApp rail v2 - the Thola lessons
*Same connection, tougher plumbing.*
- [ ] **Number health** (`lib/whatsapp/health.ts` pattern): subscribe to `phone_number_quality_update`
  + `account_update` in the webhook; store `whatsapp_number_health` (quality green/yellow/red, status
  connected/flagged/restricted/banned, tier → daily limit, display phone, flaggedAt); **throttle**
  business-initiated sends per org (`red ¼ · yellow/flagged ½ · floor 5/min`, plus tier daily cap);
  **pause** on restricted/banned with an honest reason; a **health banner** in the hub shell + a card
  on the connection with plain-English guidance ("quality dropped - we're easing off; usually recovers
  in ~7 days"); status change → audit + org-admin bell/email.
- [ ] **Retry + dead letters:** `withRetry` (3 tries, 250/1000/4000 ms ± jitter, transient only -
  408/425/429/5xx/network) around every transport; `dead_letters` UPSERT keyed by idempotency key,
  recipient **masked** (`+27•••67`), shown on the Billing page's Recent messages as "failed - we'll
  retry" vs "failed" honestly; the reminder cron's cursor only advances on a settled send.
- [ ] **Webhook idempotency + ordering:** `processed_events (provider:eventId)` claimed atomically
  before acting (Meta redelivers); delivery statuses **never regress** (sent → delivered → read); read
  receipts recorded (`read_at`) and shown as double ticks on messages we sent; `statuses[].errors[]`
  captured into `message_log.detail`. Return non-200 on a real handler failure so Meta retries
  (Thola's always-200 forfeits that).
- [ ] **Template modelling:** an org registers its **Meta-approved templates** (name, language, body,
  category, param count) in the template manager; the composer / nudge only offers approved ones
  outside the window; template send failures (e.g. 132001 "template does not exist") map to a plain
  message. (Thola documents this as its biggest open gap - M0.3b.)
- [ ] **Inbound**: the webhook already handles text + STOP; add **media types** to the log (label
  only, no download in v1), `context` (which of our messages they replied to), and mark the
  conversation window per client as today. **No two-way WhatsApp inbox in v1** - see the design line;
  the client's reply belongs in Phila. Revisit as 34.6 if the practice asks for a mirrored inbox.
- [ ] **Country-keyed cost hint** on the SMS credit row ("SA numbers only in v1") - the SMS meter is
  already per-message; note Meta bills conversations per recipient country for the org's own bill.

**Done when:** a Meta quality/tier/ban event shows on the org's connection + banner and slows or
pauses sends; a transient Meta 5xx retries and lands; a redelivered webhook is a no-op; a "read"
never turns back into "sent"; the org's approved templates are the only ones offered when the
window is closed.

## Task 34.4: An **Integrations** home for the org (Hub → Settings → Integrations)
*Where the practice sees everything it has connected - not buried under Notifications.*
- [ ] New **Settings → Integrations** page listing the org's OWN connections as cards: **WhatsApp
  Business** (moved here from Notifications; Notifications keeps a link + the enable toggle), the
  **payment gateway** (already BYO under Settings → Payments - card mirrored here), **Held items the
  platform provides** shown read-only for clarity (LivePhila video, VoicePhila minutes, SMS/Email
  credits - "provided by Phila", link to Billing). Same off / configured / live pills as the admin.
- [ ] The **WhatsApp card** absorbs Thola's connect-drawer polish: **copyable webhook URL** + verify
  token, the **5-step Meta guide** (System user token with `whatsapp_business_messaging` +
  `whatsapp_business_management`), **merge-on-save** (blank keeps the stored secret), **Test
  connection against saved creds**, the **number-health** card (34.3), display phone + verified name
  from Meta, and the existing "Help me set up" concierge (goes to the admin as an assistance request).
- [ ] **Embedded Signup (Facebook Login for Business) - designed, not built:** the OAuth shape Thola
  uses for Marketing (HMAC state + 10-min TTL, long-lived token exchange, token never in the browser)
  is the right shape for `whatsapp_business_management` + `_messaging`; needs Phila's own Meta app +
  App Review. Ship manual token entry now (already works); add the one-tap path when the Meta app is
  approved. Documented as 34.7.

**Done when:** an org admin opens Settings → Integrations, sees WhatsApp / gateway / platform rails at
a glance, connects or re-tests WhatsApp from there with the guide + webhook URL beside it.

## Task 34.5: Message alerts polish + admin visibility
- [ ] Super-admin **Integrations → WhatsApp** (org connections view) lists every org's number health
  + last event, so ops sees a flagged number before the org complains.
- [ ] Billing → Recent messages shows `new_message` nudges with channel + state; the org can see
  "12 alerts this month · 9 WhatsApp (free) · 3 SMS".
- [ ] Unit tests: `isOnline` boundary, nudge de-dupe (once per thread until read), quiet-hours for
  nudges, health throttle formula, retry classification, never-regress ordering, client-can't-start
  rule.

## Task 34.6 (later, on request): mirrored WhatsApp inbox
- [ ] If a practice insists on reading a client's WhatsApp replies inside Phila: inbound text on the
  org number from a known client's phone appends to the client thread as "via WhatsApp" (read-only,
  labelled), never the reverse (Phila → WhatsApp stays nudge-only). Consent + retention terms first.

## Task 34.7 (later): Meta Embedded Signup for one-tap WhatsApp connect
- [ ] Phila Meta app + App Review; OAuth start/callback with signed state; token exchange; auto
  `/subscribed_apps` for the webhook; falls back to manual entry when the platform app isn't set.

---

### Honest constraints
- **Meta App Review + approved templates** are external gates for out-of-window nudges - the org
  registers a `new_message` utility template exactly as they did for reminders; inside the 24h window
  the nudge is free-form and free.
- **Nudges cost the org**: WhatsApp = free in-window / Meta utility fee out-of-window on the org's own
  bill; SMS/email = Phila credits (already metered). "Once per thread until read" is the cost guard.
- **A client without a phone or email** cannot be nudged - the message still waits in Phila; the bell
  works once they log in. Honest empty state on the staff side ("no contact channel on file").
- **Presence is best-effort**: a closed laptop lid can look "online" for up to 2 minutes; the trade is
  deliberate (never spam someone who is clearly here).
- **No clinical content over WhatsApp** by design (Rule #1 confidentiality, POPIA cross-border) - the
  nudge is a doorbell.

### Done when (phase)
The practice messages a client from the client page; the client's space grows a **Messages** menu the
moment the first message lands and they can reply but never start; anyone offline gets ONE "X sent
you a message on Phila - open it" over WhatsApp (SMS/email fallback) and nothing when online; the
org's WhatsApp connection lives on a proper Integrations page with health, guide, webhook URL and
retries/dead-letters underneath; every step honest, metered, audited, dormant-by-default.

### Closeout ritual (your convention)
Each task proven live on the production build with screenshots (two signed-in browsers for the
messaging tasks: staff + client), unit tests, ROADMAP + SMOKE_TEST entries, one commit per task.
