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

**Supervision - both sides + classrooms** (batch 2)
- ☐ As a **supervised** counsellor (e.g. Aisha), `/app/supervision` shows **Your supervision**: your supervisor's card (+ Message link), notes awaiting review, changes-requested feedback with a link to revise, recent sign-offs; a sign-off decision pops an in-app notification
- ☐ As the **org**, `/hub/supervision` creates a **classroom** per supervisor - supervisees auto-join, the card shows the class **code** (copyable) + members, roster is editable
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

## 4 · Hub (`/hub`)  the practice console

Sign in as **Thandeka**.

**Overview + credits** (dashboard reworked - feedback #3)
- ☐ `/hub` overview renders with real KPIs; the **period filter** (Today / This week / This month / Last month) recomputes tiles, the payment split (**Paid online** vs **Cash / Card / EFT**), and the bookings **chart** instantly
- ☐ **Coming up next** lists the next sessions; the **Activity feed** shows humanised org events ("New session booked", "Counsellor availability updated") with who + when - no read-noise ("who looked") entries
- ☐ (If credits are low) a **"top up"** nudge banner appears linking to Billing & usage *(to force it: lower a balance in the DB, e.g. `update credit_balances set balance=12 where org_id='org_masizakhe' and channel='sms'`)*
- ☐ **Uniform widgets**: every overview widget (Coming up next · Activity feed · Team this week · Needs attention · Rooms right now) is the SAME height; long content (esp. the Activity feed) scrolls inside its card - the page never becomes one long feed
- ☐ **Team this week filters**: chips with live counts (All · Near capacity · Has room · Unverified) narrow the list; the name search finds a member; count pill updates
- ☐ **Coming up next filters**: chips with live counts (All · In person · Online · Hybrid) narrow the next 20 sessions by how they happen; the count pill updates; honest empty state per type

**Calendar** (`/hub/appointments`) (feedback #1/#2)
- ☐ Creating an appointment shows it on the calendar **immediately, no refresh**, at the correct **SAST** time
- ☐ The **counsellor filter** (avatar dropdown, default "All counsellors") and **type filter** (All / In person / Online) narrow the calendar live
- ☐ In the **New appointment** modal, picking a date + time shows "**N of M counsellors available at HH:MM**" and the counsellor dropdown only offers free counsellors
- ☐ **Hybrid** (feedback #7): the Where picker offers **In person / Online / Hybrid**; Hybrid requires a room AND generates the video link; the calendar filter gains a **Hybrid** button; the event detail reads "**room · client joins online**" with Join/Copy link; the counsellor's session page shows "Hybrid session · room" + Open video room; the client sees it exactly like an online session
- ☐ **Service colours** (batch 2f): each service on `/hub/services` has a **Calendar colour** swatch row (house palette + a rainbow swatch that opens the native picker for any colour); calendar events wear their service's colour (week/day tint, month minis, agenda left stripe) in BOTH the hub and counsellor calendars; risk/no-show tones still win; changing a colour + Save re-paints the events

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
- ☐ Invoice board shows outstanding / overdue / paid totals
- ☐ Open an invoice → A4 preview renders
- ☐ If the org gateway is connected (Settings → Payments), an unpaid invoice shows a **Pay link** button → copies a `/pay/<token>` URL

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

**Documents** (`/hub/documents`)
- ☐ The library + starter folders render; storage usage shows against the plan/override limit
- ☐ An open **document request** to a client is listed

**Funders & grants** (`/hub/funders` → a grant)
- ☐ Grant dashboard shows the **At a glance** status line + indicators **actual vs target** with a paced "expected" marker + on-track/at-risk/behind
- ☐ Post a **narrative update** → it saves and appears in the list (and later on the funder portal)

**Fee arrangement (W7, reworked 2g)**
- ☐ A client dossier's **Fee arrangement** card offers exactly three options: Standard · **Waived (funded)** · **Waived (company retainer)** - no sliding scale, no fixed fee
- ☐ Setting **company retainer** previews every service as **Free**, saves (DB `{"kind":"retainer"}`), and new bookings invoice at R0; Megan Pillay is the seeded example
- ☐ A legacy sliding-scale client (e.g. Johan, pays 50%) still shows + bills their old arrangement until changed

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
- ☐ **Feature control** (W3): turn a feature **off across the whole platform** (kill-switch) → it's disabled for every org regardless of plan; turn it back on. On an org detail page, a **force-on / force-off** per-org override wins over the plan.
- ☐ **Integrations** shows the **Phila platform gateways**: **Paystack** (key + Test connection + switch) and **Video · LiveKit** (Demo/Live mode toggle, ws URL/key/secret, **Test connection**, switch  seeded in Demo with `ws://localhost:7880`)
- ☐ **LiveKit Test connection** → "Connected" when the Docker server is up; a clear error when it's down
- ☐ **AI rail** lets you configure Claude **or** OpenAI (key + model) and switch one on
- ☐ **Audit** shows recent cross-org/PII actions (every reporting read, export, payment, edit is logged)

---

## 11 · Sanity tail (a couple of minutes)

- ☐ `npx tsc --noEmit` clean
- ☐ `npm run lint` clean
- ☐ `npx vitest run`  all green (202 unit/integration)
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
