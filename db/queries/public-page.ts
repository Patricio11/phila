import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgPublicPages, publicPageEvents, publicContactMessages, orgs } from "@/db/schema";
import { getStorageProvider } from "@/lib/storage";
import type { PublicPageContent } from "@/lib/data-provider";

/** Org public micro-site content (Phase 17)  real, persisted, no mock. */

/** A signed URL for the org's logo in a PUBLIC context (owner read, no org session).
 *  Long TTL so it outlives the page's ISR window; null when unset/dormant. */
export async function getOrgLogoUrlPublic(orgId: string, ttlSeconds = 7200): Promise<string | null> {
  const [row] = await getDb().select({ k: orgs.brandLogoKey }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!row?.k) return null;
  try {
    const storage = await getStorageProvider();
    if (storage.status !== "live") return null;
    return await storage.signedDownloadUrl(row.k, ttlSeconds);
  } catch {
    return null;
  }
}

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
    socials: {},
    showSocials: false,
    showContactForm: false,
    contactFormEmail: null,
    contactLayout: "stacked",
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
    socials: (r.socials ?? {}) as PublicPageContent["socials"], showSocials: r.showSocials,
    showContactForm: r.showContactForm, contactFormEmail: r.contactFormEmail,
    contactLayout: (r.contactLayout === "side" ? "side" : "stacked") as PublicPageContent["contactLayout"],
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
    socials: c.socials, showSocials: c.showSocials,
    showContactForm: c.showContactForm, contactFormEmail: c.contactFormEmail, contactLayout: c.contactLayout,
    ctaText: c.ctaText, seoTitle: c.seoTitle, seoDescription: c.seoDescription, updatedAt: new Date(),
  };
  await getDb().insert(orgPublicPages).values({ orgId, ...set }).onConflictDoUpdate({ target: orgPublicPages.orgId, set });
}

/* ---- Public contact form (builder upgrade) ---------------------------- */

/** Store a public contact-form submission (owner write — no session on /o pages). */
export async function createContactMessage(orgId: string, m: { name: string; email: string | null; phone: string | null; message: string }): Promise<void> {
  await getDb().insert(publicContactMessages).values({ orgId, name: m.name, email: m.email, phone: m.phone, message: m.message, createdAt: new Date() });
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
