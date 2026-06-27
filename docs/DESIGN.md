# Phila  Design & Experience

The complete design system and screen-by-screen experience for **Phila**  a world-class operational
tool for South African counselling organisations. One document, so design and UX never drift apart.
**English only. South Africa only.** The brand name is **Phila** everywhere; `philasa.com` is the web
address only.

> This system is **locked to the approved dashboard prototype** (`philasa-dashboard.html`). Every token,
> component, and interaction below is what's in that prototype  build to match it exactly, then extend
> it to the rest of the product in the same language. Read with
> [`TO_START_EVERY_SESSION.md`](./TO_START_EVERY_SESSION.md) (rules + stack) and
> [`ROADMAP.md`](./ROADMAP.md) (the phased build).

---

## 1. The idea

**Phila is a serious tool, made calm.** The reference points are the products great teams reach for 
the clarity and speed of Linear, the work-density of Jira  but tuned for care work: warmer, quieter,
and built so a counsellor between sessions or an overworked NGO manager can move fast without friction.

It is an *operational product*, not a brochure and not a wellness app. The interface earns its
"world-class" through **discipline, not decoration**: a neutral surface, one confident green, real
information density handled with air and rhythm, a smooth collapsible workspace, and motion that only
ever confirms or eases. Nothing is precious; everything is fast, legible, and sure of itself.

Three principles hold every decision:

1. **Operational clarity first.** The job gets done in the fewest moves. Density is fine when it's
   organised; the day, the caseload, the schedule are all one glance and one tap away.
2. **Calm, not loud.** A neutral system carries the work; the green accent appears only where it means
   something (the active view, the primary action, a key number). Status is a small dot, not a rainbow.
3. **Smooth, always.** The sidebar collapses smoothly, panels settle, themes cross-fade. It feels
   responsive and alive  never janky, never showy.

---

## 2. Colour  neutral system, one green

Most of the interface is neutral surfaces and text; **green (`--accent`) is the brand and the only
"loud" colour**, reserved for the active nav item, primary buttons, links, focus rings, and the few
data points that carry meaning. Status uses small dots; warnings are amber, safeguarding/danger is a
measured rose, online/info is a quiet blue. Two themes only  **light is the default**, dark is a true
companion. No "system/auto" option.

### Light (default)
| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#F3F5F4` | app background (content area) |
| `--surface` | `#FFFFFF` | cards, sidebar, raised surfaces |
| `--surface-2` | `#F8FAF9` | insets (search field, segmented control) |
| `--surface-hover` | `#F1F4F2` | hover fills |
| `--border` | `#E5E9E7` | hairlines, card borders |
| `--border-strong` | `#D5DAD8` | stronger dividers, hover borders |
| `--text` | `#141916` | primary text |
| `--text-2` | `#5B635E` | secondary text |
| `--text-3` | `#8B938E` | tertiary / captions / icons |
| `--accent` | `#1C7D58` | brand green  active nav, primary action, links, focus |
| `--accent-hover` | `#176A4A` | hover/pressed |
| `--accent-soft` | `#E5F1EB` | green tint (active-nav bg, stat icon, selected row) |
| `--warn` | `#C77F2A` | needs-attention (no-show, pending) |
| `--danger` | `#C2554D` | safeguarding / destructive |
| `--info` | `#3C7FB0` | online / informational |

### Dark
| Token | Hex |
|-------|-----|
| `--bg` | `#0D1210` · `--surface` `#151B18` · `--surface-2` `#1A211D` · `--surface-hover` `#1E2622` |
| `--border` | `#252D29` · `--border-strong` `#323B36` · `--sidebar-bg` `#101512` |
| `--text` | `#E7ECE9` · `--text-2` `#9AA39E` · `--text-3` `#6B746F` |
| `--accent` | `#34BC83` · `--accent-hover` `#43C98F` · `--accent-soft` `rgba(52,188,131,.13)` |
| `--warn` | `#DBA257` · `--danger` `#D7726A` · `--info` `#5E9AC4` |

Elevation/shadow tokens: light `--shadow-sm: 0 1px 2px rgba(16,24,20,.05)`, `--shadow: 0 1px 2px
rgba(16,24,20,.05), 0 10px 26px -14px rgba(16,24,20,.14)`; dark leans on borders with a deeper soft
shadow. The theme is set **before paint** (no flash); AA contrast holds in both.

---

## 3. Typography  Inter, set with intent

One family, used well: **Inter** (self-hosted via `next/font`, weights 400/450/500/600/700), with
**tabular numerals** on all data (`font-variant-numeric: tabular-nums`) and a slight negative tracking
(`letter-spacing: -.006em`, tightening to `-.02/-.04em` on large headings). No serif, no monospace 
the tool reads as one clean, modern voice. (Inter is the workhorse; if we ever want a touch more
character, a single distinctive display face for big numbers is the only place to spend it  not yet.)

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page / greeting | 21px | 680 | tracking −.025em |
| Section / card title | 14.5px | 650 | |
| Stat value | 26px | 700 | tabular, tracking −.04em |
| Body | 14px | 400/450 | line-height 1.5 |
| Label / meta | 12–13px | 500/600 | |
| Caption / coverage | 11–12px | 400/500 | `--text-3` |
| Overline (sidebar section) | 10.5px | 600 | uppercase, tracking .07em, `--text-3` |
| Nav item | 13.5px | 500 (600 active) | |

---

## 4. Space, radius, motion, icons

- **Grid:** 8px base. Card padding 16–17px; content padding 24–26px; gaps 14–16px.
- **Radius:** cards `12px`, controls/inputs `8–9px`, small chips/icons `7–9px`, pills `999px`.
- **Elevation:** three levels  flat (`--bg`), card (`--surface` + `--border` + `--shadow-sm`, lifting to
  `--shadow` on hover), floating (modals/sheets: `--shadow` + scrim). Warm, diffuse shadows; never hard.
- **Motion** (calm, GPU-only, reduced-motion respected):
  - Sidebar collapse: `width .28s cubic-bezier(.2,0,0,1)`; labels fade `.18s`.
  - Hovers/colour: `.15s`; theme cross-fade `.3s`.
  - The one orchestrated moment: content `rise` on load (8px + fade, `.5s`)  once.
  - Buttons depress 1px; cards lift a shadow step on hover (no transform on touch); the calendar "today"
    marker is the only ambient touch. ≤ 2 concurrent animations. `prefers-reduced-motion` → all off,
    final state shown.
- **Icons:** Lucide, 1.9 stroke, round joins. Status never relies on icon or colour alone  always a dot
  + label, or icon + text.

---

## 5. The app shell  the signature structure

The thing that makes Phila feel like a world-class tool is the **shell**: a smooth collapsible sidebar,
a calm top bar, and a content area that breathes. It's the same shell for every role; the nav contents
and accent scope change.

### 5.1 Sidebar (`248px` ↔ `72px`, collapsible, smooth)
- **Header:** the brand mark (a gradient tile holding the fine-line **aloe** glyph) + "Phila" + the
  current org name. On collapse, the labels fade and only the mark remains.
- **Sections:** an uppercase overline label ("Workspace", "Practice") over a nav group. **Nav item**
  states: default (`--text-2`), hover (`--surface-hover` + `--text`), **active** (`--accent-soft` bg,
  `--accent` text, a 3px accent bar on the left edge), optional count **badge** (accent pill, or muted).
  Icon + label; on collapse the label/badge fade and the icon centres, with the full label as a native
  tooltip.
- **Foot:** Settings, then the **Collapse** control (a chevron that rotates 180° when collapsed) above a
  top border.
- Collapsing animates the width over `.28s`; the content area reflows smoothly beside it.

### 5.2 Top bar (`64px`, sticky, translucent)
Page title + date on the left; a **search** field (`⌘K`, focus ring in accent) pushed right; the
**theme toggle** (sun/moon, light↔dark only); a **notifications** bell (with an amber dot when there's
something); and the **account** chip (avatar + name + role). Subtle `backdrop-filter` blur so content
scrolls under it cleanly.

### 5.3 Content
Max width ~1320px, generous padding, the `rise` reveal on load. A **page head** (greeting + one-line
summary on the left, primary actions on the right) sits above the work.

### 5.4 Role scoping
Same shell, different nav and home:
- **Counsellor:** Dashboard · Calendar · Clients · Sessions · Messages · (Rooms · Reports · Billing if permitted).
- **Org admin (Hub):** Overview · Calendars · Team · Rooms · Clients · Intake · Invoicing · Reports & funders · Settings.
- **Super-admin:** Orgs · Plans & billing · AI · Integrations · Audit (2FA eyebrow).
- **Funder (external):** a pared shell  only their grant(s); read-only; an "aggregate, anonymised" banner.
- **Client (`/me`):** the lightest shell  Home · Sessions · Documents · Billing · Consent.

---

## 6. Components (by their states)

Every component below is in the approved prototype or is its direct extension, in the same language.

- **Button**  `primary` (accent fill, `--accent-ink` text), `ghost` (surface + border), `mini` (small,
  outline) and `mini.solid` (small, accent) for in-row actions. States: idle / hover / pressed (1px down)
  / loading / disabled / done. Min height 44px for primary.
- **StatCard**  a tinted icon, a `trend` chip (up = accent-soft, down = rose-soft, flat = grey), a big
  tabular value, a label, and an **honest coverage line** ("412 of 530 measured" / "2 done · 4 remaining").
  Never a vanity number.
- **Card / CardHead**  title (+ a muted count pill) on the left, an action on the right: a **segmented
  control** (Day/Week), a `link`, or a button. Body padded.
- **ScheduleList / AppointmentRow**  time (+ duration/"done") · a coloured initials **avatar** · name ·
  **meta** (a status dot + state word + tags) · a right-aligned action (`Note ✓` / `Open session` /
  `Prepare`). A **"now" line** (amber label + fading rule) marks the current time. The in-progress row is
  tinted `--accent-soft`. Tags: neutral, `online` (blue), `Room N`, `Intake`, `Couple`, etc. Status dots:
  green (completed) · blue (in session) · amber (attention) · grey (upcoming).
- **Attention list**  rounded rows with a tinted icon (rose for safeguarding, amber for missed/pending),
  a title + sub, and a chevron. The triage panel.
- **Chart language**  thin lines/areas, accent stroke with a soft gradient fill, tabular value + a plain
  caption with coverage. Inline SVG; no chart-junk, no 3D, no pie-for-funnel. (See the outcomes sparkline.)
- **Avatar**  coloured initials (deterministic by name) or photo; a credential ring for verified counsellors.
- **CredentialChip**  unverified / pending / verified (HPCSA · ASCHP) / declined. Honest; never default-verified.
- **ConsentRow**  a purpose's state (booking / notes / demographics / AI / comms / care-plan / funder
  reporting); the conservative state is the quietest.
- **Tag · StatusDot · Badge · SearchField · ThemeToggle**  as built.
- **DataTable**  for clients, invoices, audit: quiet header, hover rows, sticky header, tabular numerals,
  row actions on hover, sortable. Density matches the dashboard.
- **Form & inputs**  labelled fields, accent focus ring, inline validation, a portaled custom select
  (never native), an `EncryptedField` marker on ID-number/sensitive inputs, a `ConsentField`.
- **Modal / Sheet**  floating elevation + scrim; on mobile, a bottom sheet. The **create-appointment**
  modal (client · service · counsellor · room/online · date·time·duration · recurring · notes · send) lives here.
- **Calendar**  resource lanes (counsellor / room) on desktop, an agenda day-list on mobile; today
  ringed; business-hours / buffer / break shading; events carry a quiet status dot; drag-to-reschedule
  with a confirm. Domain logic stays off the calendar lib.
- **SessionEditor**  a split surface: live note-taking (autosave, alongside the video/in-person session)
  · the **AIDraft** block (off / drafting / draft-ready, clearly "AI draft" → edit → **Sign**) · the
  **CarePlan** composer (what's shared with the client  separate from the private note) · progress
  (completed / no-show / postponed) · the video room entry.
- **RiskFlag + SafeguardingPanel**  rose, always paired with "who to contact + current help"; never
  auto-actioned; never names a method.
- **GrantCard / IndicatorMeter / ReportBuilder**  a grant + each indicator's actual-vs-target
  (on-track / at-risk / behind), k-anon, honest coverage; map indicators → a funder's template.
- **RoomScheduleGrid / RoomCard / RoomAssignmentEditor**  a room's identity + day/week bookings (who ·
  client · when · type) + utilisation; assign a counsellor to a room on a day/time pattern; conflicts inline.
- **PaymentConnectionCard · PlanCard · TeamRoleChip**  the org's own-gateway switch; plan/subscription
  state; org-team role with honest reach.
- **DocumentSheet (A4)**  invoice / intake / report as a real document: borderless fields, live totals,
  thin toolbar, clean print, scrolls on a phone.
- **EmptyState** (an invitation to act) · **Skeleton** (matches final dimensions) · **Toast** (calm,
  honest delivery states) · **Blocked state** (names the reason  consent missing / feature off / over
  cost-cap  and the next step).

---

## 7. The brand mark & voice

- **Mark:** a fine-line **aloe** (the indigenous SA healing plant  resilient, medicinal) inside a small
  green gradient tile, as in the prototype. Wordmark "Phila" in Inter 650. Used in the sidebar, app icon,
  favicon, auth art  not as wallpaper.
- **Voice:** plain, warm, certain. Sentence case, active voice, plain verbs ("Book a session," not
  "Initiate appointment"). A button and its result share a word ("Send" → "Sent on WhatsApp", only when
  it delivered). Never diagnose or label a person; AI output is "AI draft" until a human signs it.
  Safeguarding copy points to a person and current help, never names a method. Empty states are
  invitations; errors are specific and don't apologise.

---

## 8. Screen-by-screen (production-grade, on mock data)

All surfaces use the shell (§5) + components (§6) and click through end-to-end on the `dataProvider` seam
(§11) before any DB exists; Part B swaps mock → real with no UI change.

- **Counsellor  `/app`.** *Today* (the approved dashboard): stat cards, today's schedule with the "now"
  line, the outcomes sparkline, the needs-attention panel, the create-appointment action. *Calendar*
  (resource/agenda). *Clients* (DataTable + search). *Client dossier* (contact/consent/demographics-if-
  consented · session history · outcome trend · documents). *Session editor* (§6). *Supervision* (a
  sign-off queue) if supervisor.
- **Org-admin Hub  `/hub`.** *Overview*: org-wide stat cards (clients today/week/month, income +
  prediction, no-show rate, open intakes, pending credentials) + a schedule-across-counsellors view +
  attention. *Calendars* (oversight, book-on-behalf, allocate room). *Team & roles* (invite/manage, set
  role, honest permissions). *Rooms* (`RoomScheduleGrid` + utilisation + assignments). *Clients*.
  *Intake*. *Invoicing* (A4). *Reports & funders*: the consent-gated demographic dashboard + the
  grants/indicators surface (`IndicatorMeter` vs target, k-anon on export, `ReportBuilder`, invite a
  funder). *Settings*: duration/buffer/breaks, business hours, the **PaymentConnectionCard** (org's own
  gateway), the public-page editor, integration toggles (dormant by default), the theme toggle.
- **Funder portal  `/funder`** (external, read-only, scoped, audited): only their grant(s)  live
  `IndicatorMeter`s vs target, k-anon breakdowns, outcome trends, session counts, the org's narrative,
  downloadable period reports. Nothing identifiable. The growth-loop surface.
- **Super-admin  `/admin`** (2FA): orgs (create/suspend/impersonate-audited), plans + platform billing,
  the platform-only AI rail, the integrations catalogue (incl. which payment providers orgs may connect),
  platform audit.
- **Client  `/me`.** The lightest shell: next session (Join when online-ready), session history,
  **"From your counsellor"** (the shared care plan + tickable tasks  never the private note), documents,
  invoices (pay), profile, consent centre.
- **Booking  `/o/[slug]/book`.** A clean stepped flow: service + counsellor → time (honours hours /
  buffers / breaks) → intake → consent → confirm. Lightweight account at confirm. 360-first.
- **Org public page  `/o/[slug]`.** The SEO front door (§9 below).

---

## 9. The marketing & public surfaces

- **Landing (`philasa.com`).** Product-led and confident, in the tool's own visual language (not a
  separate "marketing" look). A tight nav; a hero that **shows the product**  the real dashboard in a
  clean browser frame beside a sharp headline ("Run the practice. Hold the whole journey.") and one
  primary CTA ("Book a walkthrough"); then: the daily loop shown, three pillars (the day held / the org
  in view / proof without the second job) each illustrated by a real product shot in an asymmetric
  layout, the funder story, a specific POPIA / data-in-SA trust band, who-it's-for, one real voice, and a
  calm close. Copy is plain and specific (§7). No stat-hero, no competitor names, no medical-aid claims.
- **Org public page (`/o/[slug]`).** Each org's editable, SEO-built micro-site (hero with the org's logo
  + one **brand accent**, About, Services, Team with `CredentialChip`, location/online, a prominent
  **Book**). The accent (auto-darkened via `lib/contrast.ts` if it fails AA) recolours only that page's
  primary buttons + focus ring; everything else stays Phila's system. Per-org title/meta/OG, JSON-LD
  (`MedicalBusiness`, honest copy), sitemap, SSR/ISR.

---

## 10. Responsive, accessibility, theming

- **Responsive:** 360px-first on every surface. The sidebar collapses to the icon rail and, on phones,
  becomes an overlay; the calendar becomes an agenda; the A4 builder scrolls; the dashboard grid stacks.
- **Accessibility:** WCAG 2.2 AA in both themes; visible accent focus ring; the calendar fully
  keyboard-operable; labelled controls; `aria-live` on counts, delivery states, queued/offline; targets
  ≥ 44px; text to 200%; reduced motion fully respected.
- **Theming:** **light + dark only, light default, no system option**  one token set, a single toggle,
  set before paint. The org public page's `--brand-accent` is the only per-tenant colour, scoped to that
  page. Re-skinning the whole product is an edit to `app/globals.css` (`@theme`)  components don't change.

---

## 11. The mock-data seam

Typed fixtures in `lib/mock/`, read through a `dataProvider` interface; flip `DATA_PROVIDER=mock|db` and
Part B swaps the implementation with **no UI change**. Types mirror the real schema (entities + enums in
`ROADMAP.md` Phase 10 / Appendix) and are redaction- and consent-aware (private note vs shared care plan;
demographics only when consented; funder data aggregate + k-anon). Helpers mirror Part-B logic so the
demo behaves like production: `availableSlots()`, `roomUtilisation()`, `applyKAnon(rows, floor=5)`,
`coverageNote()`. Built first (Phase 0) so every screen is real-feeling from day one.

---

## 12. Build order (design-led, Part A)

1. **Foundations:** the token system (light/dark, §2), Inter, the 8px/radius/shadow scale, motion utils,
   reduced-motion. Light default, no-flash theme switch.
2. **The shell (§5):** collapsible sidebar + top bar + content + `rise`  the thing everything sits in.
   Get the collapse and theme transitions perfect here.
3. **Core components (§6):** Button, StatCard, Card/CardHead/segmented, ScheduleList/AppointmentRow,
   Attention list, chart, Avatar, Tag/StatusDot/Badge, DataTable, Form/inputs, Modal/Sheet, Toast,
   Empty/Skeleton/Blocked.
4. The **counsellor dashboard** (`/app` Today)  already prototyped; make it the living reference build.
5. The `dataProvider` seam + mock fixtures.
6. Calendar · client dossier (session history) · session editor (with mock AIDraft + CarePlan).
7. Booking → intake → consent. Client `/me` (incl. care plan).
8. Org-admin Hub (overview, calendars, team & roles, rooms, reporting, funders & grants, settings + payment connection).
9. Funder portal `/funder`. Super-admin `/admin`.
10. Landing page (§9) + org public page + SEO.
11. Create-appointment modal + A4 DocumentSheet + video room shell (mock / paste-link).
12. States + 360 responsive pass + light/dark pass + the one motion moment + WCAG 2.2 AA.

Ship Part A as a clickable, genuinely world-class, mock-driven tool you could put in front of an NGO or
EAP tomorrow. Part B makes it real behind the seam  the UI doesn't change.

---

*Phila · philasa.com · South Africa · English · Direction: a serious tool, made calm · Locked to the
approved dashboard · Light default, dark companion · Last updated 2026-06-26*
