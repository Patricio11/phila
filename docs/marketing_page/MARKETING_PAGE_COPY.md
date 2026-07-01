# Phila `/marketing` — page copy *(source of record)*

Final copy for the conversion funnel at **`/marketing`**. Voice: **plain, direct, calm, honest — never
hypey.** Short lines for 360px. The build is the ceiling: no invented stats, no fake testimonials, no fake
scarcity, no competitor names, no medical-aid claims, no diagnosis. Prices render **live from the `plans`
table** (behind the pricing switch) — never hard-typed here.

> **Brand note (use lightly):** *Phila* is isiZulu / isiXhosa for *to heal, to be well, to live*. The domain
> is `philasa.com` (Phila + SA); the name shown to users is always **Phila**. Don't overdo the wordplay.
>
> **This file is the copy-of-record.** The page is built from it in `components/marketing/funnel.tsx` +
> `app/marketing/page.tsx` (it reuses `SiteNav`, `ClosingCta`, and `SiteFooter`). Edit the copy here first,
> then mirror it into the components.

---

## 1 — Hero

**Eyebrow:** For South African counselling organisations

**Headline:**
Run your whole practice
**from one calm place.**

**Subhead:**
Phila brings booking, the daily clinical loop, your team, documents, invoicing, and funder reporting into one
place — built POPIA-first, with client data kept in South Africa.

**Primary CTA:** Get started → `/signup`
**Secondary CTA:** Book a walkthrough → `mailto:hello@philasa.com`
**Microcopy under the buttons:** No card needed. Every integration — payments, WhatsApp, video — stays dormant
until you connect your own accounts.

---

## 2 — The problem

**Eyebrow:** The reality
**Heading:** Sound familiar?

- Booking is a back-and-forth on WhatsApp, and no-shows you can't see coming.
- Notes in one tool, files in a shared drive, the team in a group chat, invoices in a spreadsheet — none of it talks.
- Friday afternoon means rebuilding the quarter from memory for every funder.
- Consent and demographics are a POPIA worry you keep meaning to sort out.

**Close:** It's not a caring problem — it's an admin problem. That's the part Phila fixes.

---

## 3 — Who it's for

**Eyebrow:** Who it's for
**Heading:** Built for teams that hold a caseload — and a report

**✅ This is you**
- You run a multi-counsellor team — NGO, EAP, campus, or faith-based — that bills clients directly.
- You have funders to report to and demographics to track.
- Your notes, files, team, and invoicing live in five different places.
- You're a growing private practice that has outgrown a personal calendar.

**🤔 Probably not you (yet)**
- Your practice runs entirely on medical-aid claims (that's a different tool's job — Phila makes no medical-aid claims).
- You're a solo therapist who only needs a personal diary, with no team, funders, or reporting.

**Close:** If you run a team that bills clients directly and answers to funders, you're in the right place.

---

## 4 — What changes with Phila

**Eyebrow:** The difference
**Heading:** What changes with Phila

- **You never lose the thread of a client's care.** *Every session opens with what happened last time and the open goals — you pick up exactly where you left off.*
- **Your team is finally in one place.** *Private staff messaging, shared documents, rooms, and supervision — no more scattered group chats and drives.*
- **Funder reports write themselves.** *Indicators roll up live from the clinical work — consent-gated, k-anonymised, one click to the funder's template.*
- **Your clients get a calm experience.** *Two-tap booking, reminders on WhatsApp, a private space, and crisis support always one tap away.*
- **POPIA is handled, not hoped for.** *Consent, audit, field-level encryption, and tenant isolation from the first commit — client data kept in South Africa.*

---

## 5 — How it works

**Eyebrow:** How it works
**Heading:** One loop. Every day.
**Lead:** The clinical work is the product. Everything else — reporting included — falls out of it.

1. **Get found & booked** — Your public page ranks and takes bookings — service, time, intake, and consent, all before the first session.
2. **Hold the session** — Live notes alongside the room — in person or online, the same calm surface, always autosaving.
3. **Sign the note** — An AI draft you edit and sign — you're the author of record, and the structured fields are captured for reporting.
4. **Share & follow up** — Send the care plan and next steps to the client; reminders go out on WhatsApp; the team stays in sync.
5. **Report** — Indicators roll up live — k-anon, audited — and export to the funder's template in one click.

---

## 6 — Proof

**Eyebrow:** Proof
**Heading:** We'd rather show you than sell you
**Lead:** Phila is new. Open a demo workspace, book a mock appointment, sign a note, watch it roll into a funder report — as any of the five roles.

**CTA:** Explore a live demo → `/login`

**Honest line:** We won't invent five-star quotes. As our first practices go live, their words will go here — with their names on them.

**What we can promise today:**
- Built in South Africa, for POPIA — not a global tool with a privacy bolt-on.
- Client data rests in South Africa; AI is de-identified before any cross-border call, on a zero-retention provider, and audio is never stored.
- Every integration — payments, WhatsApp, video, storage — is dormant until you connect your own account. Off is a real off.
- No medical-aid claims, ever. No diagnosis. AI output is always a draft a human signs.

*(Testimonials block: keep hidden until real, named quotes exist — then populate.)*

---

## 7 — Why Phila

**Eyebrow:** Why Phila
**Heading:** Why Phila, and not a patchwork

- **POPIA-native.** Consent, audit, encryption, and tenant isolation are part of every read — not an afterthought.
- **The reporting no one else has.** A scoped, k-anon, read-only funder portal — live proof against targets, never an identifiable client.
- **One system, not seven tools.** Booking, sessions, team, documents, invoicing, and reporting — all aware of each other.
- **Bring your own, no lock-in.** Connect your own payment gateway, WhatsApp number, and video — month to month, take your data whenever.

---

## 8 — Pricing

**Eyebrow:** Pricing

**When the pricing switch is ON** (super admin → Plans & billing → *Show pricing on the landing page*):
the live tiers render from the `plans` table (`components/marketing/pricing.tsx`). Never hand-type prices.

**When the switch is OFF** (default — the `PricingTeaser`):
- **Heading:** Priced for total cost, not per seat
- **Lead:** Pricing leads with the whole cost of running your practice — with POPIA-in-SA as the wedge. We'll tailor a plan to your team and your funders.
- **CTA:** Talk to us about pricing → `mailto:hello@philasa.com`

---

## 9 — Final CTA *(shared `ClosingCta`)*

**Heading:** Bring calm to your counselling practice.
**Subhead:** We'll walk you through Phila with your own services, intake, and reporting in mind — and set it up with you. No obligation, no pressure.
**Primary CTA:** Book a walkthrough → `mailto:hello@philasa.com`
**Secondary CTA:** Explore the dashboard → `/app`

---

## 10 — Footer *(shared `SiteFooter`)*

**Brand line:** Phila · Made for South Africa · philasa.com
**Links:** How it works · For funders · Trust & POPIA · Who it's for (+ Pricing when the switch is on)
**Quiet line:** Phila holds special personal information under POPIA and is built consent-first. We never diagnose, never name a competitor, and make no medical-aid claims.

---

## Copy rules (keep these true as the page evolves)

- **Button label matches what it does** — "Get started" → the sign-up flow; "Explore a live demo" → the demo login.
- **No fabricated numbers, logos, or testimonials** until they're real and named.
- **No scarcity** ("limited spots", countdowns) — Phila is calm and honest; that's the brand.
- **Every feature claim maps to something shipped.** No AI/automation claim the build can't back.
- **Never name a competitor**, never diagnose, never make a medical-aid claim.
- **Prices come from the `plans` table**, never hand-typed — and only render when the pricing switch is on.
- **Two marketing surfaces:** `/` is the visual, product-led landing; `/marketing` is this copy-led funnel. Keep them consistent (shared nav/footer/pricing); if one becomes canonical, set the `<link rel="canonical">` accordingly.

*Phila · philasa.com · South Africa · English · `/marketing` funnel · source of record*
