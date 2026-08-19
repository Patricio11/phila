# Phila  End-to-End Smoke Test (Part B)

> Run this against your real **Neon** database in **DB mode** after `npm run db:seed` (which also seeds
> the public page, M&E cohort, subscription, forms, documents, team chat, a second tenant, and the LiveKit
> demo integration). Every box ticked = the Part B build (Phases 9–18.7 + production-readiness W1–W4) is
> verifiably working end-to-end on real data  no mock.

---

## 0 · Prerequisites & start

```bash
# .env.local must have (at minimum): DATA_PROVIDER=db, DATABASE_URL, PHILA_FIELD_KEY,
# BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://localhost:3000
npm run db:seed          # idempotent  seeds everything into Neon
npm run dev              # or: npm run build && npm run start  (prod build)
```

Open `http://localhost:3000`.

**Optional external services** (each is *dormant + honest* until set  the app never fakes them):
- **Video**  start the local LiveKit server so online sessions connect: in `phila_livekit/`, `docker compose up -d` (the seed already points the integration at `ws://localhost:7880`).
- **Payments**  to take a real (test) payment, paste a Paystack **test** key (`sk_test_…`) in `/admin/integrations` → switch on.
- **AI scribe**  to generate drafts, add an OpenAI **or** Claude key in `/admin/ai` → switch on, then turn the org consent on in Hub → Settings → AI assistant.

The seed password is **`phila1234`** for every seeded account. The `/login` page has **no role chip**  credentials identify the user; the server routes by role.

---

## 1 · Sign-in routes by role (the headline check)

Visit `http://localhost:3000/login` and try each account. Sign out between accounts (top-right user menu → Sign out).

| # | Role | Email | Password | Lands on | ✅ |
|---|---|---|---|---|---|
| 1 | Super admin | `ops@philasa.com` | `phila1234` | `/admin` | ☐ |
| 2 | Practice admin (Hub) | `thandeka@masizakhe.org.za` | `phila1234` | `/hub` | ☐ |
| 3 | Counsellor (supervisor) | `nomsa@masizakhe.org.za` | `phila1234` | `/app` | ☐ |
| 4 | Counsellor | `aisha@masizakhe.org.za` | `phila1234` | `/app` | ☐ |
| 5 | Front desk | `frontdesk@masizakhe.org.za` | `phila1234` | `/hub` | ☐ |
| 6 | Finance | `finance@masizakhe.org.za` | `phila1234` | `/hub` | ☐ |
| 7 | Funder | `palesa.mokoena@dsd.example.gov.za` | `phila1234` | `/funder` | ☐ |
| 8 | Second-org admin (Thrive) | `admin@thrive-eap.co.za` | `phila1234` | `/hub` | ☐ |

---

## 2 · Auth guards (signed-out bounce)

While **signed out**, open each URL  every one should redirect to `/login` (the public pages must NOT):

| URL | Expected | ✅ |
|---|---|---|
| `/app` | → `/login` | ☐ |
| `/hub` | → `/login` | ☐ |
| `/admin` | → `/login` | ☐ |
| `/funder` | → `/login` | ☐ |
| `/me` | → `/login` | ☐ |
| `/o/masizakhe` | **loads** (public micro-site) | ☐ |
| `/o/masizakhe/book` | **loads** (public booking) | ☐ |

Cross-tenant / cross-role checks (signed in):
- ☐ As the **funder**, opening `/funder/grants/g_lotto` (a grant they're **not** scoped to) → **404** (only `g_dsd` is theirs).
- ☐ As a **counsellor**, `/hub` and `/admin` are not reachable.
- ☐ **RLS tenant isolation:** sign in as the **Thrive admin** (`admin@thrive-eap.co.za`) → `/hub/clients` shows **only** Thrive's 4 clients (Riedwaan Adams, Chloe van Wyk, Sibongile Dube, Marius Fourie); **no** Masizakhe client (e.g. Lerato Mahlangu) ever appears. This is Postgres RLS, not just app checks.

---

## 3 · Counsellor workspace (`/app`) + AI scribe

1. Sign in as **Nomsa**. Land on `/app` (today's sessions).
2. Open **Calendar** → a day with sessions → open one.
3. Open **Clients** → a client → confirm the profile, care plan, and documents render (real DB reads, audited).
4. Open **Sessions** → open a session note editor.

✅ Boxes:
- ☐ Today dashboard shows real appointments (every counsellor now has a live day  Nomsa, Thabo, Aisha, Pieter)
- ☐ **No fresh bookings from the workspace**: the dashboard has no New-appointment button (no Ctrl-K), and **Calendar** (renamed from Appointments) has no "New" button, no click-a-slot booking, no team filter - the counsellor's own sessions only. New bookings live with the Hub / public page.
- ☐ **Sessions running out** (dashboard): a recurring series with <= 2 sessions left shows a nudge card; **Add sessions** (2/4/6/12 weeks) extends the same series - same day, time and room - the toast confirms the new end date, the client is notified, and the calendar shows the new weeks. A counsellor can only extend their OWN series (server-enforced).
- ☐ Client profile + care plan render
- ☐ **Supervision** loads (Nomsa is a supervisor)  the sign-off queue shows a supervisee note awaiting review
- ☐ **Documents** → **Shared with me** is not empty (the admin shared the Reports folder with counsellors)
- ☐ **Messages** → the seeded team threads render; sending a message persists (live if the Supabase anon key is set, else on refresh)
- ☐ **Rooms** shows the room schedule

**Classroom / supervision - both sides** (batch 2; renamed in 2p)
- ☐ As a **supervised** counsellor (e.g. Aisha), `/app/supervision` shows **Your supervision**: your supervisor's card (+ Message link), notes awaiting review, changes-requested feedback with a link to revise, recent sign-offs; a sign-off decision pops an in-app notification
- ☐ As the **org**, **Classroom** in the sidebar (was "Supervision", renamed in 2p because that page IS the classrooms) creates a **classroom** per supervisor - supervisees auto-join, the card shows the class **code** (copyable) + members, roster is editable
- ☐ The **stream**: the supervisor posts (tagged "Supervisor"), members see it in `/app/supervision`, get an in-app notification, and can reply
- ☐ **Class sessions**: the supervisor schedules one (online or in person) - members are notified, it auto-posts to the stream, and online sessions show a **Join** button (early clicks land in the waiting room; the room is staff-only); on a past session, **Mark register** records Present/Absent per member ("2 present · 1 absent" stays on the row)
- ☐ **The org inside the classroom** (batch 2e): in `/hub/supervision`, **Open classroom** shows the org the full stream (every post + session + join link); the org can post (badged **"Practice"**), schedule sessions, mark registers, and **join an online class session** (waiting room, never a bounce)
- ☐ **Repeat weekly**: the Schedule-session dialog's toggle books the same slot for 2/4/6/8/12 weeks in one go (works for the supervisor in `/app` and the org in the hub); the toast says "N weekly sessions scheduled" and the class is notified once

**Held by phone** (feedback #6)
- ☐ On a session page, the **Held by phone** card records that the session happened over a phone call - real call length (prefilled with the booked duration) + optional context; the header, sessions list (Recent tab), calendar detail, hub session view, and client timeline all show the **Phone · N min** marker; **Undo** clears it; the hub Activity feed logs "Session held by phone call"

**AI scribe** (only if a provider is switched on in `/admin/ai` **and** the org consent is on):
- ☐ In a session note, type a few clinical cues (≥ ~8 chars) → **AI draft** returns a professional, non-diagnostic note + the funder fields (presenting issue / risk / outcome / referral)
- ☐ **"Draft with AI"** on the care plan produces a client-facing summary
- ☐ With the provider **off**, the AI panel is honestly **dormant** (no fake output)

---

**One title, one place** (batch 3o) - applies on every page, every role
- ☐ The top bar shows the page title with its one-line description underneath (the date line only appears where a page has no description, e.g. pages without a PageHead); the body never repeats the page name as a second heading
- ☐ Detail pages push their identity up too (e.g. a client page shows the avatar + name in the bar); action buttons stay in the body, right-aligned

**Share by email + folder zips** (batch 3p)
- ☐ In Documents, select files or a folder -> **Email link** on the selection bar -> recipient, note, expiry -> the dialog shows the link (Copy) and says honestly whether the email went out
- ☐ The company profile's Documents card has **Email to company** (prefilled with the company contact) - shares the whole folder as one link
- ☐ The public /share/<token> page lists the files with per-file **Download** (signed URLs), **Open** for link documents, and **Download all as .zip** when there's more than one file; expiry shows and is enforced; a bad or expired token gets an honest notice
- ☐ **Folders download as ONE zip** inside Documents too (selection bar Download with a folder or several files selected); clinical documents and unscanned files never travel on a share link; every download is counted and audited

## 4 · Hub (`/hub`)  the practice console

Sign in as **Thandeka**.

**Overview + credits** (dashboard reworked - feedback #3)
- ☐ `/hub` overview renders with real KPIs; the **period filter** (Today / This week / This month / Last month) recomputes tiles, the payment split (**Paid online** vs **Cash / Card / EFT**), and the bookings **chart** instantly
- ☐ **Coming up next** lists the next sessions; the **Activity feed** shows humanised org events ("New session booked", "Counsellor availability updated") with who + when - no read-noise ("who looked") entries
- ☐ (If credits are low) a **"top up"** nudge banner appears linking to Billing & usage *(to force it: lower a balance in the DB, e.g. `update credit_balances set balance=12 where org_id='org_masizakhe' and channel='sms'`)*
- ☐ **Uniform widgets**: every overview widget (Coming up next · Activity feed · Team this week · Rooms right now) is the SAME height; long content (esp. the Activity feed) scrolls inside its card - the page never becomes one long feed. Batch 3m: **Needs attention is gone** from the org dashboard - the safeguarding flag shows on the client profile where the org acts on it; **Rooms right now** holds the fourth slot, redesigned: a segmented occupancy strip (one segment per room, lit while in session), bordered room rows with the counsellor in the room, an In session / Free chip with the until / next time, and a **View all** link to Rooms
- ☐ **Team this week filters**: chips with live counts (All · Near capacity · Has room · Unverified) narrow the list; the name search finds a member; count pill updates
- ☐ **Coming up next filters**: chips with live counts (All · In person · Online · Hybrid) narrow the next 20 sessions by how they happen; the count pill updates; honest empty state per type
- ☐ **One filter drives the whole dashboard** (batch 2m): clicking **Today** narrows the widgets too - Coming up next lists only today's sessions (its head reads "today"), the Activity feed shows only today's events, and the staffing card retitles to **Team today** with that day's load; **This month** / **Last month** widen the same way (Last month shows that month's sessions, not the future)
- ☐ A session outside practice hours (say 23:30) still appears on **Today**'s bookings chart - the chart's hours widen to cover it rather than disagreeing with the tile above
- ☐ **Clicking a session opens it in place** (batch 2m): a row in **Coming up next** opens the real appointment as a modal on `/hub` - client, state, series badge, date/time/duration/counsellor, room or Join link, and the full actions (Reschedule · Completed · No-show · Postponed · Cancel · View client) - no jump to the calendar page; Esc closes it and the dashboard is exactly where it was; rescheduling or cancelling refreshes the widgets behind it

**Calendar** (`/hub/appointments`) (feedback #1/#2)
- ☐ Creating an appointment shows it on the calendar **immediately, no refresh**, at the correct **SAST** time
- ☐ The **counsellor filter** (avatar dropdown, default "All counsellors") and **type filter** (All / In person / Online) narrow the calendar live
- ☐ In the **New appointment** modal, picking a date + time shows "**N of M counsellors available at HH:MM**" and the counsellor dropdown only offers free counsellors
- ☐ **Hybrid** (feedback #7): the Where picker offers **In person / Online / Hybrid**; Hybrid requires a room AND generates the video link; the calendar filter gains a **Hybrid** button; the event detail reads "**room · client joins online**" with Join/Copy link; the counsellor's session page shows "Hybrid session · room" + Open video room; the client sees it exactly like an online session
- ☐ **Service colours** (batch 2f): each service on `/hub/services` has a **Calendar colour** swatch row (house palette + a rainbow swatch that opens the native picker for any colour); calendar events wear their service's colour (week/day tint, month minis, agenda left stripe) in BOTH the hub and counsellor calendars; risk/no-show tones still win; changing a colour + Save re-paints the events

**Availability per session type + profile photo** (batch 2n; reworked in 3r)
- ☐ On a member page, **Availability** opens on **In person**, with **Online** beside it; there is NO Any-session chip until its toggle is switched on. Clicking a chip switches which set of hours you are editing; the blurb under it says what that set means
- ☐ **Any-session base pattern is opt-in** (batch 3r): the toggle under the chips is OFF by default; switching it on adds the **Any session** chip seeded from the practice hours (visible, ready to trim); switching it off drops those hours from the save. Saving only in-person hours stores only `in_person` rows - never a silent full-week base pattern
- ☐ Day rows read cleanly even in the narrow card: an active day's time pair sits right-aligned (wrapping to its own line when space is tight); off days read a quiet right-aligned "Off"
- ☐ Set (say) Wednesdays under **Any session** and Tuesday 17:00-20:00 under **Online**, save: the toast names the split, and `counsellor_availability` holds one row per window with its `mode`
- ☐ In **New appointment**, pick that Tuesday at 18:00: with **In person** selected the caption reads "N of M counsellors available **in person**" and that counsellor is NOT in the list; switch **Where** to **Online** and the count rises by one and they appear. Hybrid asks for in-person availability (they hold a room)
- ☐ The same rule holds on the **public booking page** (the client's In person / Online choice narrows the times offered) and in **Rooms** (assigning a room warns against their *in-person* hours, since a room is not for video)
- ☐ Server-side too: a stale tab that posts a booking outside the counsellor's window for that session type is refused with "That counsellor doesn't work online / in person at that time"
- ☐ A **counsellor** opens `/app/settings` → **Your availability** and edits their own (same editor). On save: every org admin gets a **bell notification** ("… updated their availability") and the hub **Activity feed** shows *Counsellor availability updated*
- ☐ **Profile photo**: `/app/settings` → the camera button on your avatar uploads a PNG/JPG/WebP up to 3 MB; it then shows in the header, the team roster and the member page, with **Remove** returning you to initials. It counts against the practice's storage, and replacing one releases the old bytes *(needs Phila Storage switched on in /admin → Integrations)*

**Responsive: it works on a phone** (batch 2s)
- ☐ On a phone (390px) no page scrolls sideways, in any role: hub, counsellor workspace, client portal, admin console, public page and booking. Two Playwright specs enforce this - `responsive-overflow` (47 pages x phone + tablet) and `responsive-details` (dialogs, portaled menus, wide tables)
- ☐ **Calendar** opens in **Agenda** on a phone (a seven-day grid is unreadable there) and stays on **Week** on a desktop; picking a view by hand always wins
- ☐ **Insights** on a phone reads properly: stat labels wrap instead of truncating to "2 S…", the revenue shows "R500" not "R", and each trend chip takes its own line under the value
- ☐ **Menus stay on screen**: the Export dropdown and the row (⋮) menus clamp to the viewport horizontally and flip upwards near the bottom
- ☐ Wide tables (Clients, Invoicing, Team) scroll inside their own box; the page itself never does
- ☐ **An unassigned client's record opens** (it used to 404): the dossier says "No counsellor assigned yet" and Reassign works from there

**Request a document from a counsellor** (batch 2z)
- ☐ `/hub/documents` → **Request** now opens with a toggle: **A client** / **A counsellor**, each with the searchable people-picker; the description says where the request will land
- ☐ Requesting from a counsellor writes a request with `counsellor_id` (no client) and rings that counsellor's bell with the title + note
- ☐ The counsellor's `/app/documents` shows a **"Your practice needs a document from you"** card with each pending ask and an **Upload** button; the upload lands in **their folder**, the request flips to fulfilled, and every org admin's bell rings
- ☐ A failed upload (storage down, scan failed) says so plainly and leaves the request open for a retry; guessed or stale request ids are refused server-side ("That request isn't yours")

**A folder per counsellor + document search** (batch 2r)
- ☐ `/hub/documents` → **Counsellor folders** creates one folder per counsellor, named after them, under a single **Counsellors** folder, each already shared with its owner. Pressing it again says "Everyone already has a folder" and changes nothing
- ☐ **Adding a counsellor creates their folder automatically** (invite one and look in Documents) - the button is for the team that joined before, and for restoring a deleted folder
- ☐ **Sharing sends things to their folder**: share a file or link with ONE counsellor and it moves into that counsellor's folder (client and session files stay where they belong); share with several and it stays put but reaches all of them. The dialog now takes a **note** for files and links too, not only folders, and the note travels with the share
- ☐ The counsellor opens `/app/documents` and sees **their own folder first**, badged **Your folder**, with the shared item inside it and the note under it. It appears once, not twice
- ☐ **Submissions ring the practice's bell**: the counsellor uses **Add link** in their folder; every org admin gets a notification naming who, what and which folder
- ☐ **Search**: the toolbar box searches every folder at once (file and folder names, plus client names). Each hit shows **in <folder path>**; clearing it returns to browsing. No match says so plainly

**Client data export uses the system's Export menu** (batch 2q)
- ☐ On a client profile → **Data & privacy**, **Export** is the same dropdown as every other list (CSV · Excel · PDF), not a JSON download
- ☐ Picking a format downloads `data-export-<name>-<date>.csv/.xls` (or opens the print view): columns **Section · Record · Field · Value**, covering personal details, demographics, care plan, sessions, note metadata, outcomes, consents, documents, invoices, who accessed the record, then retention and when the copy was made
- ☐ Nothing is fetched, and nothing is audited, until a format is chosen; each export writes one `dsar.export` audit row *before* the data leaves (fail-strict)
- ☐ The menu opens **upwards** when the button sits low on the page (this one does), so it is never off-screen

**Appointment modal polish** (batch 2w)
- ☐ The parked **View client** footer is gone - the client's name (with chevron) opens their record; the footer now holds the actions: **Edit · Reschedule · Completed · No-show · Postponed · Cancel** (+ **Open session** on the counsellor calendar)
- ☐ Opening Cancel / Reschedule / Edit hides the footer actions, so the panel's **Back** and its confirm are the only buttons on screen; **Back** returns without closing the modal or changing anything
- ☐ The series scope is two **real radio circles** ("This session only" / "Cancel this and all following") - visibly not buttons
- ☐ The Edit panel's counsellor field is the shared **searchable people-picker** (avatars + search), filtered to who is available for this slot in this mode

**Edit an appointment in place** (batch 2v)
- ☐ Open any appointment (calendar or dashboard) → **Edit** sits first in the action row. The panel changes **service** (duration follows), **duration**, **where** (In person / Online / Hybrid), **counsellor** and **room** - no cancel-and-rebook
- ☐ The counsellor list is **availability-aware for this very slot**: switch Where to Online and the list re-asks who works online then; a counsellor who doesn't fit shows a plain warning
- ☐ On a series, the scope toggle reads **This session only / Update all following**; saving with "all following" changes every later session in one statement (nothing cancelled, nothing recreated)
- ☐ Switching to Online clears the room; In person / Hybrid require one (the Save button waits)
- ☐ The client gets an honest **in-app** note only when HOW they meet changed; a newly assigned counsellor is notified; no misleading "rescheduled" email is sent
- ☐ A signed-in **counsellor** can edit only their own session and cannot reassign it to a colleague (server-enforced)
- ☐ Reschedule and Cancel keep their inline scope choice (this / all following) - date moves stay a separate, deliberate act

**Messages: live without realtime + the unread badge** (batch 2u)
- ☐ With Supabase Realtime unreachable (this machine's situation), a reply still lands in an **open chat within ~5s** - the view polls when the socket has not connected, merging by message id so an optimistic send is never clobbered
- ☐ The console is not flooded: after 3 socket failures the client stops retrying and polling owns delivery
- ☐ **Messages** in the sidebar carries a floating **unread count**, refreshed every 30s and on tab-focus, cleared when you land on Messages
- ☐ On a **phone**, Messages folds into **More**: the More tab carries the count, and inside the sheet the Messages row shows its number; the chat itself never scrolls sideways
- ☐ The count is org-wide (all threads), only counts others' messages, and reading a thread brings it back down

**Messages: emoji, reactions, replies, group profile** (batch 4g)
- ☐ The composer's **smiley** opens a built-in emoji picker (Smileys / Gestures / Hearts / Work + search); a pick lands at the caret; it closes on outside click / Esc; at 360 px it fits with no sideways scroll
- ☐ Hover a message → **React** shows the quick bar (👍 ❤️ 😂 🙏 👏 ✅); a tap adds a **chip** under the bubble (yours highlighted, count, names on hover); tapping again removes it; the OTHER member sees the chip appear without a reload
- ☐ Hover → **Reply** shows "Replying to …" above the composer (X cancels); the sent bubble carries the **quote**; tapping the quote scrolls to and flashes the original
- ☐ Tap the thread **header** (or the ⓘ) → **Group info**: avatar, name, "N members · created <date>", the **member list** (avatar, role, online dot, "you", "created the group"), Shared files, **Leave group** (with confirm)
- ☐ As the **creator or an org admin**: the pencil **renames** in place, **Add members** searches + multi-selects colleagues, the **X** removes a member (never the creator); every change is audited and the other members' header + count + names update **live**
- ☐ As a plain member: no pencil / Add / X - but **Leave group** works and the thread disappears for you; a removed member's thread disappears for them
- ☐ A **DM** header opens **Conversation info**: the person, role, Active now, and the files shared in that chat

**Client conversations** (Phase 34.1)
- ☐ As a client with no conversation yet, `/me` has **no Messages** menu and `/me/messages` bounces home
- ☐ As the org admin, a client page's **Message** button (or **Message client** on an appointment) opens the practice ↔ client thread in Messages: a **Client** chip on the row, a **"<name> can read this conversation"** banner, the composer note says "Visible to the client"; send a message
- ☐ The client's space now shows **Messages**; the conversation is titled with the **practice name**, staff are **named**, the info panel lists **Your care team**; the client can reply (emoji, quote, react) but has **no attach, no new message, no group, no rename/add/leave**
- ☐ The client's counsellor sees the same thread in `/app/messages` (caseload-derived - no setup); front desk sees it too; a counsellor without that client on their caseload cannot open one ("only clients on your caseload")
- ☐ The staff message rang the client's **bell**; opening the client's Messages is audited as `pii.read`

**Message alerts + presence** (Phase 34.2)
- ☐ Settings → Notifications has **Message alerts** (Alert your team / Alert clients) and the template manager carries **New message on Phila (alert)** for WhatsApp / SMS / email
- ☐ Message someone who is **not in Phila** (no tab open for 2+ min): they get the bell AND one alert on their preferred channel (see Billing → Recent messages: trigger `new_message`; honestly `Dormant` when that channel isn't configured); a **second message before they read** sends nothing more; when they open the thread the alert **re-arms**
- ☐ Message someone who **is in Phila** (any tab open): bell only, no external row
- ☐ A client with **no portal login yet** gets the alert with their **activation link**, once

**WhatsApp rail v2 + Integrations home** (Phase 34.3 / 34.4)
- ☐ Settings → **Integrations** opens with **Your connections**: WhatsApp Business (with a Number-health chip once connected), Payment gateway, and the Phila-provided rails - each honest off · configured · live, each with a Manage / Connect link; `/hub/settings?tab=integrations` lands there
- ☐ On the WhatsApp card, **Test connection** now shows the number + verified name from Meta and a **Number health** row (quality / status / tier); the guide asks Meta to subscribe `messages`, `phone_number_quality_update`, `account_update`
- ☐ Simulate (or receive) a Meta **FLAGGED / RED** event → a hub-wide banner explains it, the org admins get a bell, WhatsApp sends slow down (`throttled` rows on Billing when the ceiling is hit); a **RESTRICTION** → "sends paused" banner + `paused` rows; a recovery event clears both
- ☐ Delivery states on Billing → Recent messages never go backwards (a `Read` never becomes `Delivered`); a Meta failure shows its reason; **Failed after retries** lists dead letters with masked recipients
- ☐ As the super admin, Integrations → **Org connections** ends with **WhatsApp numbers by org** (number, name, status, health chip); Billing shows "N message alerts this month" once any alert has actually gone out

**Messages: Clients door + DSAR** (batch 4o)
- ☐ Messages → New message → **Clients** tab: an org admin sees every active client, a counsellor only their caseload; rows say Conversation open / Has a portal login / No portal login yet; picking one opens the client thread (banner "<Name> can read this conversation")
- ☐ Client → Data & privacy → Export (CSV): a **Messages with the practice** section lists the conversation; Erase blanks those messages

**Messages: @mentions + give the words back** (batch 4n)
- ☐ In a group (or any thread) type `@nom` → a list of the people in the conversation appears; Enter inserts `@Nomsa Dlamini ` plain; send → the bubble shows an **@Nomsa** chip, the list preview shows plain text, Nomsa's bell says "<You> mentioned you in <group>"
- ☐ Edit a message with a mention - the edit box shows plain `@Name`, saving keeps the chip
- ☐ Go offline (or block the request) and send - the bubble disappears again, the draft and the reply bar come back, and the toast says "Couldn't send - your words are back in the box"

**Messages: typing, composer, crisis support, web push** (batch 4m)
- ☐ Two browsers (staff + client): while one types, the other's thread shows the dots bubble + "X is typing…" in the header within ~3 s, gone ~6 s after the last keystroke - with Supabase unconfigured
- ☐ The composer is 44 px tall empty (also under a reply bar) and grows with a multi-line draft; editing a message gets the same roomy box
- ☐ As the **platform admin**, Feature control → **Platform functions** → "Crisis support in client conversations" is OFF by default; an org's Settings → Messaging → Notifications card says "Not switched on by Phila yet" and a client message such as "I don't want to be here anymore" sends with no card
- ☐ Switch it ON at the platform → the org card shows its own switch (on) → the same client message sends as written, the client alone sees the SADAG / Lifeline card under it, staff see the message with no card and a bell "<Name>'s message may need you now"; the org may switch it off for itself; switch the platform OFF again
- ☐ Admin → Integrations → **Web push**: Generate keys + switch on → Live + public key + **Notifications on this device** row; in a real browser **Turn on** → permission prompt → "Notifications on" toast → **Send me a test** shows a card; Messages shows the one-line banner only while permission is undecided; "Not now" hides it for 14 days
- ☐ With a subscribed device away from Phila, a message to that person lands as ONE push card per conversation (never the text); clicking it opens the conversation; WhatsApp / SMS / email alert is skipped for them

**S3 browser uploads (CORS)** (batch 4l)
- ☐ Admin → Integrations → Storage (Amazon S3): the **Browser uploads** panel reads the bucket's CORS rule - green "Allowed from https://philasa.com · http://localhost:3000" once set; otherwise AWS's own reason + **Allow uploads from Phila** (works when the key has `s3:PutBucketCORS`) + **Copy rule** for the console
- ☐ After the rule is in place, a hub / counsellor upload completes (the browser's preflight to the bucket answers 200, not 403)

**Documents: supervisors, recall, counsellor upload** (batch 4k)
- ☐ As a **supervisor** (Nomsa supervises Aisha / Thabo / Pieter), `/app/documents` ends with **Supervising · <name>** sections (Supervisee chip) showing each supervisee's folder + their clients' files; files open (audited); a non-supervisor sees no such section
- ☐ As any counsellor, **Upload** sits on *Your folder*, on each folder the practice shared, and on each client section; a file lands in that folder / on that client as theirs; with storage unreachable the toast says so honestly
- ☐ As the org admin, a client-visible file's menu has **Recall from client** (also on the selection bar) - the client's `/me/documents` no longer lists it, the file stays on the record; **Share with counsellors** shows **Already shared with … Stop sharing**; **Sent links** lists every emailed link with **Recall** - the public page then says the link isn't valid

**Notes on invoices** (batch 4j)
- ☐ Settings → Billing → **Invoicing & VAT** has **Note on invoices** (default text, 600 max); save it
- ☐ **Create invoice** opens the sheet with that note already in the **Notes** area under the totals; edit it in place → Create → the board's preview prints it; the client sees the same on `/me/billing`
- ☐ On an unpaid invoice → **Edit** shows **Notes on the invoice** prefilled; a change saves; a paid invoice can't be edited (as before)

**Full page** (batch 4i)
- ☐ Messages (hub / app / client space), the Appointments calendar and Documents each carry a **full-page** toggle (the expand icon on their toolbar); tapping it takes the surface over the whole viewport with a slim bar (title · what you're looking at · **Exit full page**); the sidebar, top bar and, on a phone, the floating tab bar are all hidden while open; **Esc** or Exit brings the shell back exactly as it was; a dialog opened inside (e.g. an appointment) still shows on top

**Settings shell** (batch 4h)
- ☐ `/hub/settings` shows a **left rail** of six sections with status chips (Verified · N channels on · N features on · Gateway live / Trial · 2FA on/off); clicking slides the active marker and the panel rises; each section has **sub-tabs** with a hint line (Organisation → Profile / Branding / Client portal / Public page / Verification, etc.)
- ☐ The URL follows you (`?tab=…&sub=…`); a deep link such as `/hub/settings?tab=security&sub=compliance` opens on that panel; leaving a section and coming back remembers its sub-tab; a half-typed form survives switching
- ☐ On a phone the rail becomes **wrapping pills** - all six sections visible at once (a small dot carries each status), the sub-tabs wrap too; nothing to swipe for and no sideways page scroll

**Storage backend: Supabase or Amazon S3** (batch 2o)
- ☐ `/admin/integrations/storage` offers two chips: **Supabase** and **Amazon S3**. The chip you are not on shows *configured* when its credentials are stored, so switching back needs no retyping
- ☐ Picking **Amazon S3** asks for region, bucket, access key ID, secret and an optional endpoint (MinIO / Cloudflare R2), and stops asking for a Supabase project URL
- ☐ Switching on with a half-filled form is refused: "Add the region, bucket, access key ID, and secret before switching S3 on."
- ☐ After saving, the card header reads **Phila Storage · Amazon S3**, the secret is never echoed back to the browser, and **Test connection** reports honestly rather than pretending
- ☐ **Nothing is orphaned by a switch**: documents, onboarding uploads, org logos, profile photos and chat attachments each record the backend they were written to, so files uploaded before the switch still open afterwards. New uploads go to the newly chosen backend and count against the practice's storage allowance either way

**Team - full profile editing** (batch 2i)
- ☐ On a member page, **Edit profile** edits EVERYTHING: name · phone · date of birth · address · bio · display languages · specialties · education rows (add/remove) · and for counsellors the **credential** (body + registration number)
- ☐ Changing the credential warns, saves, and resets verification to **pending** (re-verify under Verification); the header name, Personal & contact card and Education card all show the new truth immediately

**Team - availability & offboarding** (`/hub/team` → a counsellor) (feedback #4/#5)
- ☐ The member page has an **Availability** card - "follows the practice working hours" by default; **Set availability** opens the weekly editor (seeded from practice hours); saving lands on the dashboard **Activity feed**
- ☐ Signed in as that **counsellor**, `/app/settings` shows **Your availability** read-only ("managed by your practice") - no edit controls
- ☐ **Archive** on an active counsellor opens the offboard dialog: honest workload counts, then **migrate to a successor** or **cancel upcoming (clients notified)** - afterwards their sessions/notes/history are all still on the record (nothing deleted), and the member can be restored

**Waiting room** (feedback #10)
- ☐ Open an online session's join link **early** (from the email or the portal) → the **waiting room** renders: session details + a ticking countdown + "doors open 15 minutes before"; at T-15 it lets you into the pre-join automatically
- ☐ A tampered link still says expired/incorrect; a link for a session **more than 3h past** says "already taken place"; a cancelled session says it was cancelled
- ☐ On `/me`, an early online session shows **"Open waiting room"** (never a dead button)

**Exports** (feedback #9)
- ☐ `/hub/clients` and `/hub/team` both have an **Export** dropdown - CSV downloads and opens anywhere, **Excel** (.xls) opens in Excel with a bold header row, **PDF** opens a print-ready document (org · date · count) for Save-as-PDF; the file matches the on-screen list; each client export lands in the audit log as **pii.export** with format + row count
- ☐ The same Export dropdown is the house standard everywhere: Insights Practice tab, Reports tab, Funder reporting, and the platform audit ledger (`/admin/audit` - exporting the ledger is itself audited)

**Rooms - live & recorded** (`/hub/rooms`) (feedback #8)
- ☐ The **Right now** band shows "N of M rooms in use" with pulsing chips; a room with a session running shows **"In use · who · until when"** on its card; **Next up** shows relative times ("in 40 min")
- ☐ On a room page, **Assign** really persists (check `room_assignments`): assigning over a counsellor's availability, their other room, or another counsellor's slot first shows **honest warnings** with "Assign anyway"; assignments are removable (hover the row); both actions land on the Activity feed
- ☐ **Who was in this room**: pick any date → counsellors · sessions · hours from the permanent record
- ☐ The dashboard shows the **Rooms right now** widget with per-room live status

**Billing & usage** (`/hub/billing`)
- ☐ SMS + email balances, **AI spend vs cap** bar, recent message activity, top-up history all render
- ☐ Credit packs show with prices; **Buy** a pack → if Paystack is on, redirects to checkout; if off, an honest "not switched on yet" message

**Invoicing** (`/hub/invoicing`)
- ☐ **Billing never slips** (batch 2): marking a session **Completed** auto-raises its invoice; the appointment detail modal shows the invoice inline (number · amount · status) or a **Generate invoice** button; the invoicing page banner lists completed-but-uninvoiced sessions with one-click **Generate N invoices**; **Bill to** in the builder is searchable
- ☐ **Page notices dismiss** (batch 3n): the unbilled-sessions banner (and the verification nudge + duplicate-clients notice) has an **X** - closing it clears it for this browser session; it honestly returns next session because the underlying fact still stands
- ☐ Invoice board shows outstanding / overdue / paid totals
- ☐ **The board, by state** (batch 3k): status tab pills **All / Unpaid / Overdue / Paid / Cancelled** with live counts filter the table; totals always read the whole book, not the filtered tab; client rows carry avatars and an **Issued** column
- ☐ **Every row has a ⋮ menu** (batch 3k): **View invoice** (A4 preview) on every row; unpaid rows add **Edit**, **Copy pay link** (gateway on), **Send reminder**, **Cancel invoice** (danger); cancelled rows offer **Reinstate**; paid rows offer only View - money has moved
- ☐ **Edit an unpaid invoice** (batch 3k): ⋮ → Edit → dialog with service name, amount (R) and due date → Save; the row and totals update; the change lands in the audit log (`edit_invoice`)
- ☐ **Cancel, never delete** (batch 3k): cancelling keeps the invoice on the books under the Cancelled tab (HPCSA records rule); Reinstate returns it to Unpaid; a paid invoice refuses both edit and cancel with an honest message ("money has moved" / "refund through your gateway")
- ☐ Open an invoice → A4 preview renders **in true A4 proportions** (batch 3l): the sheet keeps the 210x297 silhouette even when short, with banking details + thank-you pinned to the bottom like a printed page
- ☐ **Create invoice actually creates** (batch 3l): `/hub/invoicing/new` → **Create invoice** saves a real unpaid invoice (server-allocated number, audit-logged `create_invoice`) and returns to the board; the old button only showed a toast
- ☐ **Link a session** (batch 3l): the builder's searchable "Link a session" picker offers every unbilled session (APT ref · date · client · service); picking one aligns the Bill-to client, prefills the line from the session's service, and prints "Session ref: APT-XXXXXX" + a session banner on the sheet; a second invoice for the same session is refused with the existing number
- ☐ If the org gateway is connected (Settings → Payments), an unpaid invoice shows a **Pay link** button → copies a `/pay/<token>` URL

**No client double-booking** (batch 3t)
- ☐ Book a client, then try to book (or reschedule) the SAME client into an overlapping time with a different counsellor: refused with "This client already has a session at that time - move or cancel it first." (public booking says "You already have a session booked at that time")
- ☐ This is a DB exclusion constraint (appt_no_client_overlap, scheduled sessions only) - it holds even for two simultaneous requests, and history (completed / no-show) is never retroactively policed

**Times on the practice's clock** (batch 3y)
- ☐ In **New appointment**, the Time field is a dropdown of the practice's grid: opening hour stepping by service duration + interval (50 min + 10 min = on the hour); switching to a longer service re-steps the grid; a closed day falls back to the free picker
- ☐ **Reschedule** offers the same grid for the session's own duration

**Reschedule = free pickers + honest warning** (batch 3s slots, reverted by the practice in 3x)
- ☐ **Reschedule** uses the free date + time pickers, prefilled with the session's ACCURATE SAST time (a 09:00 session shows 09:00, not the raw UTC 07:00)
- ☐ Picking a time outside the practice hours or that counsellor's availability warns on the first click ("Outside the practice hours or this counsellor's availability for that day. You can still move it.") - the second click, **Move anyway**, proceeds: the practice decides, informed
- ☐ The DB exclusion constraints still hold whatever is picked: a move that double-books the counsellor, the room, or the CLIENT is refused with its honest message

**Appointment references** (batch 3l) - every session answers to a short code
- ☐ The appointment detail modal shows **Reference** (e.g. `APT-3F9A2C`, derived from the id - every past session already has one); clicking it copies
- ☐ **⌘K search**: typing a reference (`APT-3F9A2C`, or just `3f9a2c`) offers **Open session APT-XXXXXX** → lands on the calendar with that session's modal open (`/hub/appointments?ref=...` deep-links the same way; an unknown ref gets an honest "No session found" toast)
- ☐ The invoice board's search matches APT refs; linked rows show the ref under the invoice number; the A4 preview prints the session line (date · counsellor · ref)
- ☐ **Notifications carry the ref**: booked / rescheduled / cancelled / reminder / no-show messages append `Ref: APT-XXXXXX` (or place it wherever a custom template puts `{reference}`); email subjects carry it too - only Meta-approved WhatsApp templates can't (params fixed by Meta)

**Messaging  WhatsApp-first** (Settings → **Messaging** → Manage messaging) (W7)
- ☐ **WhatsApp** leads as the **primary channel** with the free-24h-window explainer; SMS/email are the metered backups
- ☐ The connect form shows the BYO Meta fields (Phone number ID, WABA ID, access token, app secret, verify token) + a copyable **webhook URL** and **verify token**; when connected, a **Test connection** button pings Meta and (on success) shows a **Verified** badge
- ☐ **Message templates**: editing a template's preview shows the sample with **highlighted** auto-filled tokens; a WhatsApp template documents the `{{1}}..{{6}}` positional order for out-of-window sends
- ☐ **Waitlist** (W7): add a client to the waitlist from their detail; on `/hub/appointments` a **Waitlist** card lists them with one-tap prefilled **Book**; cancelling a session offers the freed slot to matching waiting clients (dormant-safe message + in-app notification)

**Insights** (`/hub/insights`)  session analytics **and** the M&E reporting differentiator
- ☐ Session volumes + **trend chips** (vs the previous period) on completed / attendance / new clients / revenue
- ☐ Switching the period (week / month / quarter) updates the figures
- ☐ Client-mix cuts honour consent (coverage shown)
- ☐ The **Funder reporting** tab shows headline stats (**Clients reported**, **Improved ≥5 on PHQ-9 %**, **Provinces reached**), key-findings bullets + a paragraph from real figures, k-anon breakdowns ("too few to report" where suppressed), and the shared **Export** dropdown (CSV / Excel / PDF, k-anonymised - suppressed cells export as "suppressed (<k)"; every export audited)
- ☐ The old `/hub/reporting` URL **redirects here** (bookmarks don't break)
- ☐ **Reports tab** (batch 2): seven report types (Bookings summary → Payment pending) across six periods load live; **search** filters the rows; **Export** downloads CSV / Excel / PDF matching the table; every export lands in the audit log as `pii.export` with the row count

**Forms** (`/hub/forms`)
- ☐ The library shows the seeded **Intake** + **"After your session"** feedback forms with sent/completed counts
- ☐ Open the feedback form → **Responses** shows the open **share link**; visiting `/f/s_feedback_masizakhe` (no login) renders the themed two-pane fill page
- ☐ Create / duplicate / archive a form; the **builder** (Build + Design tabs) previews live

**Forms** (batch 2l) - `/hub/forms`
- ☐ **New form** offers templates with step counts - **Full intake (3 steps)** and **K10 distress scale (2 steps)**; picking one fills a real multi-step form, and **Add step (section break)** builds one from scratch (section cards show "Step N starts here"; the header shows "N steps for the client")
- ☐ The builder offers every input type (short text · paragraph · number · date · phone · email · single choice · dropdown · tick-all · **linear scale** · acknowledgement · statement · **section**); a **section** makes the client's form multi-step (progress rail, Back/Continue, per-step validation)
- ☐ A form page shows **Send automatically** (when a booking is made / after N attended sessions) and **Counsellors may send this** (all or named); the automation fires by itself and sends a client a given form only once
- ☐ `/app/forms` (counsellor): forms shared with them, **Send** to their OWN clients only (another counsellor's clients are never listed), and **From your clients** with each completed response openable in full
- ☐ A completed response also appears on the client's record (counsellor dossier + hub) with a **Score** chip for scale forms

**Documents** (`/hub/documents`)
- ☐ **Add link** creates a LINK document (Google Doc etc.) that opens in a new tab; link rows show the link icon + "link" size; the selection bar gains **Download** (all files in selected folders/files)
- ☐ **Three dots (⋮)** on a document row: Open/Download · Rename · Assign to client · Share · Delete; on a folder card: Open · Rename · Share · Delete; in `/app/documents` a counsellor's own link has Open · Edit link · Remove (their own only - server-enforced)
- ☐ **Share a folder** offers Select-all counsellors, an instruction **note**, and **"Counsellors see only their own files"**; in `/app/documents` the shared folder shows as a card with the note + badge; a counsellor's **Add link** submission is visible to them + the org but NOT to other counsellors (server-filtered)
- ☐ The library + starter folders render; storage usage shows against the plan/override limit
- ☐ An open **document request** to a client is listed

**Funders & grants** (`/hub/funders` → a grant)
- ☐ Grant dashboard shows the **At a glance** status line + indicators **actual vs target** with a paced "expected" marker + on-track/at-risk/behind
- ☐ Post a **narrative update** → it saves and appears in the list (and later on the funder portal)

**Fee arrangement (W7, reworked 2g)**
- ☐ A client dossier's **Fee arrangement** card offers exactly three options: Standard · **Waived (funded)** · **Waived (company retainer)** - no sliding scale, no fixed fee
- ☐ Setting **company retainer** previews every service as **Free**, saves (DB `{"kind":"retainer"}`), and new bookings invoice at R0; Megan Pillay is the seeded example
- ☐ A legacy sliding-scale client (e.g. Johan, pays 50%) still shows + bills their old arrangement until changed

**Form responses as PDF** (batch 3w)
- ☐ A completed response's dialog (org side) and the waitlist answers dialog have **Download PDF** - a print-styled A4 of the Q&A (sections as headers, quiet dash for unanswered, POPIA footer); the client portal's completed forms each carry a **PDF** button too
- ☐ The browser's print dialog saves it - same zero-dependency pattern as table exports and the invoice sheet

**"Other" with an input** (batch 4c)
- ☐ On any choice field (single choice, dropdown, multi-select), an option named **Other** / "Other (please specify)" reveals a "Please specify..." input when picked; the answer stores as one string ("Other: Sepedi") and reads naturally in responses, exports and the PDF

**One practice per email + team soft delete** (batches 4a-4b)
- ☐ Inviting an email that's an ACTIVE (or invited) member of ANOTHER practice is refused: "They must be archived or removed there before this email can be used here." - archiving/removing at the other practice frees the email
- ☐ An **archived** member's ⋯ menu offers **Delete member** (soft): the record stays (status `removed`), access stays revoked, the email frees up; a **Removed** tab (appears when non-empty) lists them with **Restore member**; deleting an ACTIVE member is refused (archive-first hands the workload over)
- ☐ Archived and removed memberships grant NO access at sign-in

**LivePhila - video minutes** (batches 4d-4f)
- ☐ Billing & usage shows a **LivePhila** card: minutes **left**, minutes **used**, Low chip, and the **R950 / 26,500 minutes** pack (units say "minutes", not "credits")
- ☐ Marking an **online or hybrid** session **Completed** consumes its booked length - once (re-marking never double-charges); the ledger keeps every charge against the appointment
- ☐ Crossing the low mark (2,650 min) or hitting zero raises a **bell to every org admin AND an email** - once per crossing; SMS/Email crossings do the same (25 credits)
- ☐ Zero minutes never blocks care: sessions still run and complete; the org is told loudly instead
- ☐ Admin → org → **Resources & quotas** has a **LivePhila minutes** meter: grant any amount (cash/EFT paid outside the system) - ledgered as "grant", audited, and the org's admins get a bell with the new balance
- ☐ **No plan promises minutes**: every plan surface says "LivePhila minutes by top-up" - the balance only changes by purchase or admin grant

**Submission emails, in the org's words** (batch 3j)
- ☐ A form's detail page has an **Emails** tab: a toggle ("Email the practice on every submission"), recipients (comma-separated; **empty = every practice admin**), and an editable **subject + message** with tokens `{name}` `{form}` `{practice}` `{date}` filled at send time
- ☐ A bad address is refused naming the value; settings persist per form
- ☐ Submitting the form (assignment link or share link) triggers the send through the practice's Resend rail - best-effort and **bounded at 4s**, so the person's thank-you screen never waits on a mail server

**Real-intake template + Edit is org-only** (batch 3i)
- ☐ The **Full intake** template now collects everything a real counselling intake asks: name + surname, contact number, email, **date of birth** (was a bare age number - the retention clock runs on DOB), **counsellor preference (language and/or religion)**, **how they'd like to meet (online / in person)**, and a free-text **"in your own words"** reason alongside the checklist
- ☐ **Edit on an appointment is the practice's only**: the org sees the Edit chip on the calendar and dashboard; a counsellor sees Reschedule and the status marks but **no Edit**, and the server refuses a counsellor's edit regardless ("Editing a session's details is done by the practice")

**One Create-folder dropdown** (batch 3h)
- ☐ The Documents toolbar's three folder buttons (New folder / Client folder / Counsellor folders) collapsed into one **Create folder ▾** dropdown, styled like Export: **Empty folder** · **Client folder** (pick one, or create for all) · **Counsellor folders** - each opening its existing flow

**Client folders on demand** (batch 3g)
- ☐ Documents toolbar → **Client folder** opens a dialog: the searchable client picker, **Create folder** for one, or **Create for all N clients** in the footer
- ☐ Creating for one client opens their new folder; asking again says **"<name> already has a folder"** and just opens it - never a duplicate
- ☐ Create-for-all reports honestly: "42 folders created · 43 clients · 1 already had one"
- ☐ Client folders live under **Documents → Clients**, wear the person icon, and **a client's upload against a request files into their folder automatically** (covered by an integration test - the filing happens at insert, before storage is even reached)

**Company documents, one folder, two doors** (batch 3f)
- ☐ Every company has a folder under **Documents → Companies**, named after them - created with the company, ensured (and healed) whenever its profile is opened, renamed when the company is renamed
- ☐ The **company profile** has a **Documents** card that IS that folder: the list (links + files, newest first, open in a click), **Upload** and **Add link** filing straight into it, and the toast says where it went
- ☐ **Open in Documents** deep-links into the manager already inside the folder (`?folder=`), breadcrumb Home → Companies → <name>
- ☐ In the Documents tree, company folders wear the **building icon** (as counsellor folders wear the people icon)

**The waitlist closes its loop** (batch 3d)
- ☐ `/hub/waitlist` now has **Waiting / Booked** tabs (with counts), employer filter chips beside them, avatars on every row, and per-tab empty states
- ☐ **Booking anywhere settles the wait**: book a waiting person from the waitlist page, the calendar modal, the company Employees tab, or even let them self-book - the server flips their entry to *placed* with a timestamp, no UI has to remember
- ☐ The person moves from **Waiting** to **Booked** automatically; the Booked row shows *Booked <date>* and *Next session <when> · <counsellor>*; Book/remove only show on waiting rows
- ☐ The **company profile's Employees** list agrees: the *Waiting* chip becomes **Booked · <date>** the moment a session exists
- ☐ Booked entries stay visible for 90 days, then age out of the list (the client record keeps everything)

**EAP: the practice books, from an intake form** (batch 2t)
- ☐ Adding or editing a company asks **Who books the session?** - *Employees book themselves* (the original) or *The practice books*. Choosing the second asks for an **intake form**, and saving switches on that form's share link **and** the client waitlist, saying so in the toast
- ☐ The employee link is unchanged (`/o/{slug}/book?c=…`): for a practice-books employer it **redirects to the intake form** carrying the company token, so a link already shared never goes stale. Submitting a booking with that token is refused server-side too
- ☐ Completing the intake creates a **real client**: linked to the employer, fee set to **Waived (company retainer)**, their answers on their record (not a floating share response), and an entry on the **waitlist**. Every org admin gets a bell notification naming the person and the employer
- ☐ An existing client (matched by **email only** - colleagues share phone numbers) is linked to the employer rather than duplicated
- ☐ **Clients → Waitlist** (button beside Companies) lists everyone waiting: employer, how long they have waited, a link to read their answers, **Book** (the ordinary appointment modal, prefilled) and remove. Filter chips per employer
- ☐ The company page has an **Employees** section for the practice: who is linked, who is still waiting, sessions held, next session, and Book. *Nothing here reaches the employer* - their own export stays aggregate
- ☐ On any form, **Everyone who completes this joins the waitlist** does the same thing without an employer, and switches the waitlist on with it
- ☐ With the waitlist feature **off**, `/hub/waitlist` still opens and says nobody new is being added (people already waiting never become invisible)

**EAP companies (batch 2j, moved in 2p)** - `/hub/companies`
- ☐ **Companies is no longer in the sidebar**: it opens from the **Companies** button on the far right of the Clients status-filter row (companies are clients - an employer paying for its staff). The button carries the count; the page has an **All clients** link back; ⌘K still finds "Companies"

- ☐ **Add company** (name · contact · per-session rate) → card shows Paid / Used / Sessions + "R... left"; **Record payment** grows the retainer; the ledger lists every payment
- ☐ **Employee booking link** (`/o/<slug>/book?c=<token>`): the wizard shows the "Covered by <company>... only ever sees anonymous usage numbers" banner; booking creates a client invisibly linked (company_id) on the **company retainer** fee (R0, no invoice)
- ☐ A held session draws the rate down (Used up, Remaining down, monthly row appears); the **Export** (CSV/Excel/PDF) is aggregate-only - months, sessions, amounts, totals - with the confidentiality line, and NO employee name anywhere on the page or in the file

**Language of record (Phase 32.0)** *(feature-switched: Settings → Integrations per org; super-admin kill-switch in `/admin` Feature control. Off = none of the below exists and booking runs pre-32.0)*
- ☐ Team → open a counsellor (e.g. Aisha Patel) → a **Languages** card shows native-name chips; **Edit languages** offers toggle chips grouped by tier ("Live translation ready" etc.); saving persists and is audited
- ☐ A client dossier shows **Record language** (or the recorded language + a "needs interpretation" chip); recording a home language + "how is the gap handled today" saves to the client row
- ☐ Clients hub: a **language filter** appears beside the counsellor filter; the clients **Export** includes a Language column
- ☐ New appointment modal: after picking a client with a recorded language + a time, the availability caption counts speakers ("1 speaks isiZulu") and speaker counsellors are hinted **"Speaks isiZulu"** in the dropdown

---

## 5 · Public micro-site + section editor + booking + SEO

**The editor** (Hub → **Settings** → scroll to the public-page section)
- ☐ Each section (Hero, About, How we work, Services, Team, FAQ, Contact, SEO) is editable, with **eye toggles** to show/hide
- ☐ Add/remove an **approach point** and an **FAQ** item
- ☐ A **stats strip** shows views / booking clicks / booked / conversion %
- ☐ Click **Save public page** → toast confirms; **View live** opens `/o/masizakhe`

**The live page** (`/o/masizakhe`)
- ☐ Hero (headline + intro + POPIA badge + dual CTA), How-we-work cards, Services (real durations/prices), Team with **verified credential chips**, FAQ accordion, Contact + locations, final CTA band  all render and reflect your edits
- ☐ Light/dark toggle works; mobile (360 px) has no horizontal scroll

**Booking** (`/o/masizakhe/book`)
- ☐ Pick a service (deep-link `?service=` preselects) → **language** (native names; "Another language" reveals Tier 3) → time → intake → consent → confirm
- ☐ Booking in a non-English language **prefers a counsellor who speaks it** (e.g. isiXhosa → Aisha) and records `home_language` + an honest `interpretation_needed` on the new client
- ☐ **No counsellor step** (feedback #5) - the page says "we'll match you with an available counsellor"; a time is offered while *any* counsellor is free and the booking auto-assigns the **least-loaded** free counsellor (the confirm step shows who)
- ☐ Online booking returns a **room link**; in-person assigns a room
- ☐ Booking the appointment increments the **booked** count on the editor stats (PII-free funnel)

**SEO**
- ☐ `view-source` on `/o/masizakhe` shows a custom `<title>`/description + a `MedicalBusiness` **JSON-LD** block (with FAQ questions)
- ☐ `/sitemap.xml` lists `/o/masizakhe`; `/robots.txt` allows `/o/` and disallows `/app/`, `/hub/`, `/admin/`

---

## 6 · Video (LiveKit)  *requires the Docker server running*

1. As **Thandeka** (or the counsellor), open an **online** appointment and copy its room link, **or** book an online session and use the returned link (`/room/<id>?t=…`).
2. Open the link.

✅ Boxes:
- ☐ A branded **waiting room** (camera/mic preview, device pickers) renders
- ☐ Join → the **call** connects (camera toggle, mic, screen share, chat, leave)
- ☐ With the Docker server **stopped**, the room shows an honest "video unavailable" state (no crash)

---

## 7 · Payments (Paystack)  *requires a test key*

After pasting `sk_test_…` in `/admin/integrations` → **Test connection** (should say "Connected") → switch on:

- ☐ **Credits**: Hub → Billing & usage → Buy a pack → Paystack checkout → pay (test card) → return → balance tops up (idempotent; no double count)
- ☐ **Subscription**: Hub → Billing & usage → **Change plan** → pick a plan → pay → the plan activates (`/hub/settings` shows the new plan)
- ☐ **Org gateway**: Settings → Payments → paste your **own** test key → Test → switch on → an invoice **Pay link** → `/pay/<token>` → pay → invoice marked **paid** (funds settle to the org)

---

## 8 · Funder portal (`/funder`)

Sign in as **Palesa** (the DSD funder).

- ☐ `/funder` lists only **their** grant(s) with committed amount + period
- ☐ Open the grant → read-only dashboard: **At a glance** line, indicators vs target, **k-anonymised** breakdowns, PHQ-9 trend, and the narrative the org posted in §4
- ☐ The "aggregate, anonymised, audited" banner is present; nothing identifies a client

---

## 9 · Client portal (`/me`)

Sign in as a client account (see `docs/DEMO_LOGINS.md` for a seeded client email).

- ☐ `/me` home, **Your steps**, **Sessions**, **Documents**, **Billing**, **Consent**, **Profile** all render
- ☐ Toggling a **consent** persists and is audited
- ☐ An online session shows a **join** link
- ☐ **Request a change** (W7): on `/me/sessions`, an **upcoming** session shows **Request reschedule** / **Request cancellation**; submitting with a reason shows the "we'll be in touch" state (the booking is **not** changed  the practice gets the request); a session inside the org's notice window instead asks the client to phone
- ☐ **Pay online** (W7): on `/me/billing`, an **unpaid** invoice shows **Pay R…** (when the org's gateway is on) that opens the signed `/pay/<token>` page; otherwise EFT details are shown

---

## 10 · Admin (`/admin`)  integrations are admin-managed (no env keys)

Sign in as **ops@philasa.com**.

- ☐ Every tab loads: Overview, **Organisations**, **Users**, **Onboarding**, **Plans & billing**, **Feature control**, **AI rail**, **Integrations**, **Audit**
- ☐ **Organisations** shows a real multi-tenant list (Masizakhe + Thrive + the lightweight extra tenants) with plan, status, and onboarding stage; opening one shows its **Plan**, **Resources & quotas**, per-org **feature overrides**, and onboarding review
- ☐ **Users** lists platform operators + org members (search/manage)
- ☐ **Plans & billing** (W3.4): edit a plan (price / seats / AI / video / storage / messaging) inline → **Save** persists; the change applies to every org on that plan. The **landing-pricing** switch shows the tiers on `/` only when on.
- ☐ **Waitlist + Outcomes switches** (batch 2h): Feature control shows **Client waitlist** and **Outcome tracking** cards with descriptions; killing one hides its every hub/app surface (queue card, dossier button, outcome tiles/trends/capture) while data is kept; the org's Settings switch shows locked with the reason; restore brings it all back
- ☐ **Feature control** (W3): turn a feature **off across the whole platform** (kill-switch) → it's disabled for every org regardless of plan; turn it back on. On an org detail page, a **force-on / force-off** per-org override wins over the plan.
- ☐ **Integrations** shows the **Phila platform gateways**: **Paystack** (key + Test connection + switch) and **Video · LiveKit** (Demo/Live mode toggle, ws URL/key/secret, **Test connection**, switch  seeded in Demo with `ws://localhost:7880`)
- ☐ **LiveKit Test connection** → "Connected" when the Docker server is up; a clear error when it's down
- ☐ **VoicePhila · Twilio** (33.2/33.3): the platform tab shows a **VoicePhila · Twilio** card (VOICE); its config page takes Account SID / auth token (write-only), the **shared caller number**, and mode **Off / Mock / Live**; **Test connection** in Mock answers "calls simulate instantly", in Live it pings the Twilio account. Off = fully dormant, no org sees any voice surface
- ☐ **Voice webhook meters exactly once** (33.3): a completed leg posted to `/api/webhooks/voice` with a valid signature bills **ceil(seconds/60)** minutes off the org's voice balance (e.g. 500 s → 9 min), a webhook **retry does not double-charge** (ledger key `voice_leg_<id>`), a wrong signature gets **403**, and crossing the low threshold (100 min) rings the org-admin bell + email
- ☐ **"Call client" from the session** (33.4/33.7): with the voice rail on, the session editor and the appointment modal show the call panel; the button dials the counsellor first, then bridges the client (both see the shared number); the panel walks **dialling → ringing → connected → completed**, lists **every attempt**, sums the **system-measured total**, and offers **Call again** after a drop. Blocked states name their reason: no client number / no counsellor profile number / **out of call minutes** (the button never places a broken call). With the rail **off**, no call surface exists anywhere
- ☐ **Role-aware + responsive panel** (33.7 polish): a **counsellor** sees just "Phone the client on the practice number." + the button - **no minutes left**; an **org admin** sees "… - N min available" (they do the topping up); the out-of-minutes reason tells the counsellor to ask their admin, the admin to top up. At **360 px** the panel wraps cleanly - no horizontal scroll
- ☐ **Held by phone lands automatically** (33.7): a completed VoicePhila call marks the session **Held by phone · N min** with the carrier-measured minutes (header chip + card); the manual "Record phone call" entry still works for calls made outside the platform
- ☐ **Org Billing: VoicePhila minutes** (33.6): with the rail on, Billing & usage shows a fourth card - balance, minutes used, low chip under 100 - and the **voice bundles from the admin catalogue** (e.g. 1,000 min = R800) purchasable like SMS/Email/LivePhila; with the rail off the card and bundles stay hidden
- ☐ **AI rail** lets you configure Claude **or** OpenAI (key + model) and switch one on
- ☐ **Audit** shows recent cross-org/PII actions (every reporting read, export, payment, edit is logged)

---

## 11 · Sanity tail (a couple of minutes)

- ☐ `npx tsc --noEmit` clean
- ☐ `npm run lint` clean
- ☐ `npx vitest run`  all green (**308** unit/integration at 2026-08-18)
- ☐ `npm run build` clean, then `npm run start`  the paths above still work on the production build
- ☐ Dark mode looks right across Hub, the public site, and the funder portal
- ☐ Mobile (360 px): no horizontal scroll on `/o/masizakhe`, `/hub/insights`, `/funder`

---

## When every box is ticked

Tell Claude **"All smoke tests pass"** and I'll record it in `docs/completed/` and tag the Part B build as smoke-verified.

---

## If something fails

- **`DATABASE_URL is not set` / "Part A runs on mock"**  `DATA_PROVIDER=db` must be in `.env.local`, and `DATABASE_URL` uncommented. Restart the dev server after editing.
- **Sign-in fails for a seeded account**  re-run `npm run db:seed` (idempotent). Better Auth needs the account present + verified; the seed sets this.
- **A reporting/grant page is empty or all "too few to report"**  the M&E cohort didn't seed. Re-run `npm run db:seed`; you should have ~39 consented clients (k-anonymity then shows real counts for the big cells).
- **Video says "not configured"**  the LiveKit integration is off, or the Docker server isn't running. Check `/admin/integrations` → Video is **switched on** (Demo), and `docker compose up -d` in `phila_livekit/`.
- **"Payments aren't switched on yet"**  expected until you add a Paystack key in `/admin/integrations` (platform) or Settings → Payments (org gateway). This is the honest dormant state, not a bug.
- **AI panel stays dormant**  both gates must be on: a provider switched on in `/admin/ai` **and** the org consent toggle on in Hub → Settings → AI assistant.
- **Public page edits don't show**  the page is ISR-cached; saving calls `revalidatePath`, so a hard refresh should show them. Confirm the save toast appeared.
- **Encrypted config won't decrypt after a key change**  `PHILA_FIELD_KEY` must be stable. If you regenerated it, re-seed and re-enter any keys (Paystack/AI/LiveKit) in the admin console.
