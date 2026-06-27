# Phase 1  Phila landing + org public page (SEO) ✅

*Shipped: 2026-06-27 · Part A (mock-first) · Builds on Phase 0*

> Goal: the marketing face + each org's findable, editable front door. Mock data, production-grade UI.

## What shipped

### Task 1.1  Phila landing (`/`)
A product-led, fully responsive landing in the tool's own visual language (not a separate marketing
look), with **smooth, GPU-only, scroll-choreographed motion** that fully respects
`prefers-reduced-motion`:
- **Hero**  a sharp headline ("Run the practice. Hold the whole journey.") + **one** primary CTA,
  beside the **real dashboard** in a clean browser frame (`ProductFrame` + `DashboardPreview`, built
  from the *actual* product components, gently floating) over an on-brand drifting glow.
- **The daily loop** (open the day → hold the session → sign the note).
- **Three pillars**, asymmetric, each illustrated by a real product fragment (today's schedule,
  org calendars + utilisation, grant indicators vs target).
- **Funder story** with a scoped `/funder` portal preview (indicators vs target, k-anon caption).
- **A specific POPIA / data-in-SA trust band** (residency, consent, audit, RLS, encryption, the
  POPIA pack)  concrete, not slogans.
- **Who it's for** (NGO / EAP / university / faith-based), **one honest human voice** (framed as the
  reality we solve, no fabricated customer), a **calm close**, and a footer.
- No stat-hero, no competitor names, no medical-aid claims. Sticky translucent nav with a mobile sheet
  and the light/dark toggle.

### Task 1.2  Org public page (`/o/[orgSlug]`)
- `<OrgPublicShell>`: hero (brand tile + intro), About, **Services** (duration + price/Enquire),
  **Team** (`<CredentialChip>`  honest verified/pending/unverified, never default-verified),
  location + online, prominent **Book** CTA. A calm on-brand `/o/[slug]/book` holding page so nothing
  dead-ends (the full stepped flow is Phase 2).
- **SEO:** per-org `generateMetadata` (title/meta/OG), JSON-LD (`MedicalBusiness`, honest
  non-diagnostic copy), `generateStaticParams` (SSG), canonical URLs. The landing + public pages opt
  back into indexing; the app stays `noindex`.
- **Contrast-safe `--brand-accent`** via the new `lib/contrast.ts` (auto-darkens to keep white-on-accent
  AA). Scoped to that page's primary actions only  the rest stays Phila's system.

## New building blocks
- `components/marketing/*` (Reveal island, SiteNav, Hero, ProductFrame, DashboardPreview, DailyLoop,
  Pillars, FunderStory, TrustBand, WhoItsFor, Voice, ClosingCta, SiteFooter, SectionHeading).
- `components/public/org-public-shell.tsx`, `components/ui/credential-chip.tsx`.
- `lib/contrast.ts`. Provider seam grew `getOrgPublicPage(slug)` + `listOrgSlugs()` (mock + db stub);
  `orgPublicContent` fixtures.
- Motion: `.reveal` scroll-reveal (IntersectionObserver island, `js`-class guarded, reduced-motion
  safe), `.float`, `.drift`  all opacity/transform only.

## Verification
- `npm run build` clean. Routes: `/` (static), `/app` (dynamic), `/o/[slug]` (**SSG**, `/o/masizakhe`
  prerendered), `/o/[slug]/book`, `/offline`.
- `typecheck` + `lint` clean.
- Runtime: `/` renders all sections; `/o/masizakhe` shows services (R450 / Enquire), team with honest
  credentials, JSON-LD `MedicalBusiness`, online tag; an unknown slug 404s; the book holding page renders.

## Next  Phase 2
Booking & intake flow (`/o/[slug]/book`): service + counsellor → time (honours hours/buffers/breaks
via `availableSlots`) → intake → consent (`<ConsentField>`) → confirm. Replaces the holding page.
