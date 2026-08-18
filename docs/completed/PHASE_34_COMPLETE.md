# ✅ Phase 34 complete (core) - Client messaging + the WhatsApp nudge + WhatsApp rail v2

*Closed 2026-08-18 for 34.1-34.5. Plan: `docs/PHASE_34_CLIENT_MESSAGING_WHATSAPP_PLAN.md` (written
after a deep read of Thola v2's WhatsApp layer). Five commits, each proven live with two or three
signed-in browsers. Governing design held throughout: conversations live IN Phila (WhatsApp is the
doorbell, never the room), the practice always speaks first, nudge only when it helps.*

## What shipped

**34.1 · Client conversations** (`bbc92e4`, plan correction `6a25683`) - `message_threads.kind =
"client"` + `client_id` (migration 0080; one thread per client via the pair key). **Message** on the
client page (hub + counsellor app) and **Message client** on the appointment modal open THE
conversation and deep-link to it (`?t=`). Practice-side membership derives from role / caseload and
self-heals on every list (admins + front desk see every client thread, a counsellor their caseload,
no migration when staff change); the client's login joins on activation. Staff see a **Client** chip
+ a "<name> can read this conversation" banner; the client's space grows a **Messages** menu only once
a thread exists (server-gated), a single full-width conversation titled with the practice - staff
named, "Your care team" in the info panel, reply / emoji / react / quote, **no attach, no new, no
manage**. A shared messaging principal (staff | client) enforces the rules server-side; direct staff
threads refuse a client login; opening the client's Messages logs `pii.read`.

**34.2 · Presence + the alert** (`2cc65ec`) - the shell heartbeats every 60 s while a tab is visible
(`user_presence`; online = seen < 2 min). After any message, every other member gets the bell once
per thread until read (`thread_members.nudged_at`, cleared on read - a thread opened on arrival now
moves the cursor too) and, only when offline, ONE external "X sent you a message on Phila - open it"
through the same `deliver()` chokepoint (new trigger `new_message`, org-editable templates; the org's
WhatsApp number when connected, else SMS / email from credits; opt-out, quiet hours, metering apply).
Never the message body; a client with no login gets the activation link once. Settings → Notifications
gained **Message alerts** (staff / clients; migration 0081). Runs after the response (`after()`).

**34.3 (core) + 34.4 · WhatsApp rail v2 + Integrations home** (`6cb3c26`) - Meta's quality / limit
/ ban webhooks (HMAC-verified, routed by display phone, idempotent via `processed_events`) →
`whatsapp_number_health`; sends throttled by quality (red ¼, yellow / flagged ½, floor 5/min, + tier
daily cap; business-initiated only) and paused when restricted / banned; a hub-wide banner + a health
card with plain-English guidance; status changes bell + audit the org's admins. Jittered transient-only
retry around every transport at the chokepoint; exhausted transient failures → `dead_letters`
(masked) + "Failed after retries" on Billing. Delivery states never regress; read receipts kept;
Meta error reasons captured; redelivered webhooks are no-ops; a handler failure answers 500 so Meta
retries. Test connection stores the display phone + verified name. Settings → Integrations opens with
**Your connections** (WhatsApp with health, gateway, LivePhila / VoicePhila / SMS / Email; `?tab=`
deep links). Migration 0082 + RLS.

**34.5 · Ops visibility** (`b0de56f`) - super-admin Integrations → Org connections lists every org's
WhatsApp number + Meta health; Billing shows "N message alerts this month · x WhatsApp · y SMS · z
email".

## Verification
34.1: three browsers (admin, client, counsellor) - no menu → thread opened from the client page → menu
appeared → client replied with a quote → admin + counsellor saw it → care team listed → membership /
audit rows matched → 360 px clean. 34.2: one honest SMS-lane alert (BulkSMS not configured →
"dormant"), no second alert before read, heartbeat + read re-armed, a client reply belled online
Thandeka only and alerted offline Nomsa, an online client got the bell with no external row. 34.3/4:
signed Meta-shaped webhooks on the second tenant - bad signature 401; FLAGGED/RED/TIER_250 → banner +
card + admin bell, redelivery no-op; read → a late "delivered" ignored; failed carried code 131026;
ACCOUNT_RESTRICTION → "sends paused" banner; RESTORED + UNFLAGGED/GREEN/TIER_1K → banner gone;
Integrations home rendered. Unit tests: 16 new (alert rules, presence boundary, health, retry,
ordering) - 308 total at close.

## Left honestly (in the plan)
- 34.1: the Messages page **New message → Clients** tab door; client threads in **DSAR export /
  erasure / retention**.
- 34.3: Meta-approved **template modelling** (language / category / params + a real picker - waits
  for live Meta credentials); inbound **media labels**; the country cost hint.
- 34.6 (on request): a mirrored WhatsApp inbox. 34.7: Meta Embedded Signup for one-tap connect.
