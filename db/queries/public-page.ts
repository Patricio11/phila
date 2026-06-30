import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgPublicPages, publicPageEvents } from "@/db/schema";
import type { PublicPageContent } from "@/lib/data-provider";

/** Org public micro-site content (Phase 17)  real, persisted, no mock. */

/** Sensible starter content for an org without a saved page yet. */
export function defaultContent(opts: { intro?: string; about?: string }): PublicPageContent {
  return {
    heroHeadline: null,
    heroSubtitle: opts.intro ?? "",
    showOnlineBadge: true,
    aboutTitle: "About us",
    aboutBody: opts.about ?? "",
    showAbout: Boolean(opts.about),
    approachTitle: "How we work",
    approachItems: [],
    showApproach: false,
    showServices: true,
    showTeam: true,
    faqItems: [],
    showFaq: false,
    showContact: true,
    contactEmail: null,
    contactPhone: null,
    ctaText: "Book a session",
    seoTitle: null,
    seoDescription: null,
  };
}

function toContent(r: typeof orgPublicPages.$inferSelect): PublicPageContent {
  return {
    heroHeadline: r.heroHeadline, heroSubtitle: r.heroSubtitle ?? "", showOnlineBadge: r.showOnlineBadge,
    aboutTitle: r.aboutTitle, aboutBody: r.aboutBody ?? "", showAbout: r.showAbout,
    approachTitle: r.approachTitle, approachItems: r.approachItems, showApproach: r.showApproach,
    showServices: r.showServices, showTeam: r.showTeam,
    faqItems: r.faqItems, showFaq: r.showFaq,
    showContact: r.showContact, contactEmail: r.contactEmail, contactPhone: r.contactPhone,
    ctaText: r.ctaText, seoTitle: r.seoTitle, seoDescription: r.seoDescription,
  };
}

export async function getPublicPageContent(orgId: string): Promise<PublicPageContent | null> {
  const [r] = await getDb().select().from(orgPublicPages).where(eq(orgPublicPages.orgId, orgId)).limit(1);
  return r ? toContent(r) : null;
}

export async function savePublicPageContent(orgId: string, c: PublicPageContent): Promise<void> {
  const set = {
    heroHeadline: c.heroHeadline, heroSubtitle: c.heroSubtitle, showOnlineBadge: c.showOnlineBadge,
    aboutTitle: c.aboutTitle, aboutBody: c.aboutBody, showAbout: c.showAbout,
    approachTitle: c.approachTitle, approachItems: c.approachItems, showApproach: c.showApproach,
    showServices: c.showServices, showTeam: c.showTeam, faqItems: c.faqItems, showFaq: c.showFaq,
    showContact: c.showContact, contactEmail: c.contactEmail, contactPhone: c.contactPhone,
    ctaText: c.ctaText, seoTitle: c.seoTitle, seoDescription: c.seoDescription, updatedAt: new Date(),
  };
  await getDb().insert(orgPublicPages).values({ orgId, ...set }).onConflictDoUpdate({ target: orgPublicPages.orgId, set });
}

/** PII-free funnel event (Phase 17): view | book_click | booked. */
export async function recordPageEvent(orgId: string, kind: "view" | "book_click" | "booked"): Promise<void> {
  try {
    await getDb().insert(publicPageEvents).values({ orgId, kind, at: new Date() });
  } catch {
    // analytics must never break a page render
  }
}

export async function getPageStats(orgId: string, sinceDays = 30): Promise<{ views: number; bookClicks: number; booked: number; conversion: number }> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await getDb().select({ kind: publicPageEvents.kind }).from(publicPageEvents).where(and(eq(publicPageEvents.orgId, orgId), gte(publicPageEvents.at, since)));
  const views = rows.filter((r) => r.kind === "view").length;
  const bookClicks = rows.filter((r) => r.kind === "book_click").length;
  const booked = rows.filter((r) => r.kind === "booked").length;
  return { views, bookClicks, booked, conversion: views ? Math.round((booked / views) * 100) : 0 };
}
