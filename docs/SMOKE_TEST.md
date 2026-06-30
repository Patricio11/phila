# Phila — End-to-End Smoke Test (Part B)

> Run this against your real **Neon** database in **DB mode** after `npm run db:seed` (which also seeds
> the public page, M&E cohort, subscription, and the LiveKit demo integration). Every box ticked = the
> Part B build (Phases 9–17.1) is verifiably working end-to-end on real data — no mock.

---

## 0 · Prerequisites & start

```bash
# .env.local must have (at minimum): DATA_PROVIDER=db, DATABASE_URL, PHILA_FIELD_KEY,
# BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://localhost:3000
npm run db:seed          # idempotent — seeds everything into Neon
npm run dev              # or: npm run build && npm run start  (prod build)
```

Open `http://localhost:3000`.

**Optional external services** (each is *dormant + honest* until set — the app never fakes them):
- **Video** — start the local LiveKit server so online sessions connect: in `phila_livekit/`, `docker compose up -d` (the seed already points the integration at `ws://localhost:7880`).
- **Payments** — to take a real (test) payment, paste a Paystack **test** key (`sk_test_…`) in `/admin/integrations` → switch on.
- **AI scribe** — to generate drafts, add an OpenAI **or** Claude key in `/admin/ai` → switch on, then turn the org consent on in Hub → Settings → AI assistant.

The seed password is **`phila1234`** for every seeded account. The `/login` page has **no role chip** — credentials identify the user; the server routes by role.

---

## 1 · Sign-in routes by role (the headline check)

Visit `http://localhost:3000/login` and try each account. Sign out between accounts (top-right user menu → Sign out).

| # | Role | Email | Password | Lands on | ✅ |
|---|---|---|---|---|---|
| 1 | Super admin | `ops@philasa.com` | `phila1234` | `/admin` | ☐ |
| 2 | Practice admin (Hub) | `thandeka@masizakhe.org.za` | `phila1234` | `/hub` | ☐ |
| 3 | Counsellor (supervisor) | `nomsa@masizakhe.org.za` | `phila1234` | `/app` | ☐ |
| 4 | Counsellor | `thabo@masizakhe.org.za` | `phila1234` | `/app` | ☐ |
| 5 | Funder | `palesa.mokoena@dsd.example.gov.za` | `phila1234` | `/funder` | ☐ |

---

## 2 · Auth guards (signed-out bounce)

While **signed out**, open each URL — every one should redirect to `/login` (the public pages must NOT):

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

---

## 3 · Counsellor workspace (`/app`) + AI scribe

1. Sign in as **Nomsa**. Land on `/app` (today's sessions).
2. Open **Appointments** → a day with sessions → open one.
3. Open **Clients** → a client → confirm the profile, care plan, and documents render (real DB reads, audited).
4. Open **Sessions** → open a session note editor.

✅ Boxes:
- ☐ Today dashboard shows real appointments
- ☐ Client profile + care plan render
- ☐ **Supervision** loads (Nomsa is a supervisor)
- ☐ **Rooms** shows the room schedule

**AI scribe** (only if a provider is switched on in `/admin/ai` **and** the org consent is on):
- ☐ In a session note, type a few clinical cues (≥ ~8 chars) → **AI draft** returns a professional, non-diagnostic note + the funder fields (presenting issue / risk / outcome / referral)
- ☐ **"Draft with AI"** on the care plan produces a client-facing summary
- ☐ With the provider **off**, the AI panel is honestly **dormant** (no fake output)

---

## 4 · Hub (`/hub`) — the practice console

Sign in as **Thandeka**.

**Overview + credits**
- ☐ `/hub` overview renders with real KPIs
- ☐ (If credits are low) a **"top up"** nudge banner appears linking to Billing & usage *(to force it: lower a balance in the DB, e.g. `update credit_balances set balance=12 where org_id='org_masizakhe' and channel='sms'`)*

**Billing & usage** (`/hub/billing`)
- ☐ SMS + email balances, **AI spend vs cap** bar, recent message activity, top-up history all render
- ☐ Credit packs show with prices; **Buy** a pack → if Paystack is on, redirects to checkout; if off, an honest "not switched on yet" message

**Invoicing** (`/hub/invoicing`)
- ☐ Invoice board shows outstanding / overdue / paid totals
- ☐ Open an invoice → A4 preview renders
- ☐ If the org gateway is connected (Settings → Payments), an unpaid invoice shows a **Pay link** button → copies a `/pay/<token>` URL

**Reporting** (`/hub/reporting`) — the M&E differentiator
- ☐ Headline stats: **Clients reported**, **Improved ≥5 on PHQ-9 %**, **Provinces reached**
- ☐ Funder narrative shows **key-findings bullets** + a paragraph generated from real figures
- ☐ Breakdowns show real counts where cells ≥ 5 and **"too few to report"** where suppressed (k-anonymity)
- ☐ **Download CSV** produces a k-anonymised file

**Insights** (`/hub/insights`)
- ☐ Session volumes + **trend chips** (vs the previous period) on completed / attendance / new clients / revenue
- ☐ Switching the period (week / month / quarter) updates the figures
- ☐ Client-mix cuts honour consent (coverage shown)

**Funders & grants** (`/hub/funders` → a grant)
- ☐ Grant dashboard shows the **At a glance** status line + indicators **actual vs target** with a paced "expected" marker + on-track/at-risk/behind
- ☐ Post a **narrative update** → it saves and appears in the list (and later on the funder portal)

---

## 5 · Public micro-site + section editor + booking + SEO

**The editor** (Hub → **Settings** → scroll to the public-page section)
- ☐ Each section (Hero, About, How we work, Services, Team, FAQ, Contact, SEO) is editable, with **eye toggles** to show/hide
- ☐ Add/remove an **approach point** and an **FAQ** item
- ☐ A **stats strip** shows views / booking clicks / booked / conversion %
- ☐ Click **Save public page** → toast confirms; **View live** opens `/o/masizakhe`

**The live page** (`/o/masizakhe`)
- ☐ Hero (headline + intro + POPIA badge + dual CTA), How-we-work cards, Services (real durations/prices), Team with **verified credential chips**, FAQ accordion, Contact + locations, final CTA band — all render and reflect your edits
- ☐ Light/dark toggle works; mobile (360 px) has no horizontal scroll

**Booking** (`/o/masizakhe/book`)
- ☐ Pick a service (deep-link `?service=` preselects) → time → intake → consent → confirm
- ☐ Online booking returns a **room link**; in-person assigns a room
- ☐ Booking the appointment increments the **booked** count on the editor stats (PII-free funnel)

**SEO**
- ☐ `view-source` on `/o/masizakhe` shows a custom `<title>`/description + a `MedicalBusiness` **JSON-LD** block (with FAQ questions)
- ☐ `/sitemap.xml` lists `/o/masizakhe`; `/robots.txt` allows `/o/` and disallows `/app/`, `/hub/`, `/admin/`

---

## 6 · Video (LiveKit) — *requires the Docker server running*

1. As **Thandeka** (or the counsellor), open an **online** appointment and copy its room link, **or** book an online session and use the returned link (`/room/<id>?t=…`).
2. Open the link.

✅ Boxes:
- ☐ A branded **waiting room** (camera/mic preview, device pickers) renders
- ☐ Join → the **call** connects (camera toggle, mic, screen share, chat, leave)
- ☐ With the Docker server **stopped**, the room shows an honest "video unavailable" state (no crash)

---

## 7 · Payments (Paystack) — *requires a test key*

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

---

## 10 · Admin (`/admin`) — integrations are admin-managed (no env keys)

Sign in as **ops@philasa.com**.

- ☐ Every tab loads: Overview, Organisations, Onboarding, Plans & billing, **AI rail**, **Integrations**, **Audit**
- ☐ **Integrations** shows the **Phila platform gateways**: **Paystack** (key + Test connection + switch) and **Video · LiveKit** (Demo/Live mode toggle, ws URL/key/secret, **Test connection**, switch — seeded in Demo with `ws://localhost:7880`)
- ☐ **LiveKit Test connection** → "Connected" when the Docker server is up; a clear error when it's down
- ☐ **AI rail** lets you configure Claude **or** OpenAI (key + model) and switch one on
- ☐ **Audit** shows recent cross-org/PII actions (every reporting read, export, payment, edit is logged)

---

## 11 · Sanity tail (a couple of minutes)

- ☐ `npx tsc --noEmit` clean
- ☐ `npm run lint` clean
- ☐ `npx vitest run` — all green (102+ unit/integration)
- ☐ `npm run build` clean, then `npm run start` — the paths above still work on the production build
- ☐ Dark mode looks right across Hub, the public site, and the funder portal
- ☐ Mobile (360 px): no horizontal scroll on `/o/masizakhe`, `/hub/reporting`, `/funder`

---

## When every box is ticked

Tell Claude **"All smoke tests pass"** and I'll record it in `docs/completed/` and tag the Part B build as smoke-verified.

---

## If something fails

- **`DATABASE_URL is not set` / "Part A runs on mock"** — `DATA_PROVIDER=db` must be in `.env.local`, and `DATABASE_URL` uncommented. Restart the dev server after editing.
- **Sign-in fails for a seeded account** — re-run `npm run db:seed` (idempotent). Better Auth needs the account present + verified; the seed sets this.
- **A reporting/grant page is empty or all "too few to report"** — the M&E cohort didn't seed. Re-run `npm run db:seed`; you should have ~39 consented clients (k-anonymity then shows real counts for the big cells).
- **Video says "not configured"** — the LiveKit integration is off, or the Docker server isn't running. Check `/admin/integrations` → Video is **switched on** (Demo), and `docker compose up -d` in `phila_livekit/`.
- **"Payments aren't switched on yet"** — expected until you add a Paystack key in `/admin/integrations` (platform) or Settings → Payments (org gateway). This is the honest dormant state, not a bug.
- **AI panel stays dormant** — both gates must be on: a provider switched on in `/admin/ai` **and** the org consent toggle on in Hub → Settings → AI assistant.
- **Public page edits don't show** — the page is ISR-cached; saving calls `revalidatePath`, so a hard refresh should show them. Confirm the save toast appeared.
- **Encrypted config won't decrypt after a key change** — `PHILA_FIELD_KEY` must be stable. If you regenerated it, re-seed and re-enter any keys (Paystack/AI/LiveKit) in the admin console.
