"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { savePublicPageContent } from "@/db/queries/public-page";

/**
 * Save the org's public micro-site (Phase 17). Org-admin only, validated, audited,
 * and the public page is revalidated so edits go live immediately.
 */
const item = z.object({ title: z.string().trim().max(120), body: z.string().trim().max(600) });
const faq = z.object({ question: z.string().trim().max(200), answer: z.string().trim().max(900) });
const nullableStr = (max: number) => z.string().trim().max(max).nullable().transform((v) => (v ? v : null));
// A social link: https URL (or bare handle-less wa.me). Empty string = not set.
const socialUrl = z.string().trim().max(300).refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), "Links must start with https://");
const socials = z.object({
  whatsapp: socialUrl.optional(), instagram: socialUrl.optional(), facebook: socialUrl.optional(),
  x: socialUrl.optional(), linkedin: socialUrl.optional(), youtube: socialUrl.optional(), tiktok: socialUrl.optional(),
});

const input = z.object({
  slug: z.string().min(1),
  heroHeadline: nullableStr(120),
  heroSubtitle: z.string().trim().max(400),
  showOnlineBadge: z.boolean(),
  aboutTitle: z.string().trim().min(1).max(80),
  aboutBody: z.string().trim().max(2000),
  showAbout: z.boolean(),
  approachTitle: z.string().trim().min(1).max(80),
  approachItems: z.array(item).max(6),
  showApproach: z.boolean(),
  showServices: z.boolean(),
  showTeam: z.boolean(),
  faqItems: z.array(faq).max(12),
  showFaq: z.boolean(),
  showContact: z.boolean(),
  contactEmail: nullableStr(120),
  contactPhone: nullableStr(40),
  socials,
  showSocials: z.boolean(),
  showContactForm: z.boolean(),
  contactFormEmail: z.string().trim().email("Enter a valid email for contact messages.").max(120).or(z.literal("")).nullable().transform((v) => (v ? v : null)),
  ctaText: z.string().trim().min(2).max(40),
  seoTitle: nullableStr(70),
  seoDescription: nullableStr(180),
});

export async function savePublicPage(raw: z.infer<typeof input>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the content." };
  const { slug, ...content } = parsed.data;
  // Keep only filled-in social links.
  content.socials = Object.fromEntries(Object.entries(content.socials).filter(([, v]) => v));

  await savePublicPageContent(membership.orgId, content);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/public_page`, reason: "edit_public_page" });
  revalidatePath(`/o/${slug}`);
  return { ok: true };
}
