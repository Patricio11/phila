# Phase 17  Org public page real + SEO ✅

*Shipped: 2026-06-30 · Part B · org-editable, SEO-ranking public micro-sites, fully DB-backed (no mock)*

> Goal: a world-class public micro-site per org, where the org **manages every section**,
> wired to booking, with real SEO  and all of it **seeded + read from the DB**.

---

## Real, section-based content (no mock)
- New **`org_public_pages`** table (migration 0020, RLS'd): hero (headline/intro/CTA/online badge),
  about, **approach** (list), services + team (visibility), **FAQ** (list), contact (phone/email),
  SEO (title/description)  each section with its own **show/hide** flag.
- `db-provider.getOrgPublicPage` is **overridden** to read it, with services / team / sites from the real
  tables. Masizakhe is **seeded** with rich, ready-to-rank content (3 approach points, 4 FAQs, contact).
- `db/queries/public-page.ts`: `getPublicPageContent`, `savePublicPageContent`, `recordPageEvent`,
  `getPageStats`, plus `defaultContent` for orgs without a saved page.

## World-class micro-site (`/o/[slug]`, SSG + ISR)
A calm, modern page: brand-tinted **hero** (org headline + voice, POPIA badge, dual CTA), **how we work**
cards, **services** with real durations/prices (deep-link to booking), **team** with verified credentials,
a native-accordion **FAQ**, **contact** (tap-to-call/email) + locations, and a final **CTA band**. The org's
brand accent recolours only the primary actions (auto-darkened to stay AA). Light + dark, mobile-first.

## Section editor (the Hub)
A smooth editor where the org manages **each section**: edit copy, toggle visibility (eye switches),
**add/remove** approach points + FAQ items, set SEO title/description, and **View live**. One **Save**
persists and **revalidates** the live page so edits go live immediately. A **stats strip** shows views /
booking clicks / bookings / **conversion %** (last 30 days).

## SEO
- Per-org `generateMetadata`: custom **title / description / canonical / OpenGraph / Twitter** (falls back
  to sensible defaults from name + province + intro).
- **JSON-LD**: `MedicalBusiness` (honest, non-diagnostic) + `Service` list + FAQ `Question`s.
- **`app/sitemap.ts`** (every org page) + **`app/robots.ts`** (`/o/` indexable; app / hub / admin / funder /
  api / pay / room disallowed).

## Booking wired + PII-free conversion analytics
The public page deep-links into the existing booking flow (`?service=`). A **`public_page_events`** table
(no visitor data) records the funnel: **view** (a tiny beacon, ISR-safe) → **book_click** (server-side on the
book page) → **booked** (server-side on a successful booking). The editor surfaces the conversion.

## Proof
- Integration tests: seeded content read, edit round-trip (toggle + field) + restore, and the
  view/book_click/booked funnel with a computed conversion %. Full suite green; prod build clean;
  tsc + lint clean. Screenshots in `/screenshots`.

## Honest follow-ups
- Dynamic OG image (`opengraph-image.tsx`)  metadata OG is wired; a generated image is a nice next step.
- Custom domains per org  **deferred** (documented extension); `/o/[slug]` is the canonical home for now.
- Drag-reorder of sections  sections render in a clean fixed order today; reordering is a future nicety.
