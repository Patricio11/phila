"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgs, orgMembers, orgPublicPages } from "@/db/schema";
import { createContactMessage } from "@/db/queries/public-page";
import { createNotification } from "@/db/queries/notifications";
import { sendPlatformEmail } from "@/lib/email/platform-email";
import { contactMessageEmail } from "@/lib/email/templates";

const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * Public contact form (builder upgrade). No session — the org is resolved by slug
 * and the form only works when the org has switched it on. Defences: a honeypot
 * field (bots fill it → pretend success), a per-IP/org rate limit, and tight Zod
 * caps. The message is STORED first (source of truth), then best-effort fan-out:
 * a branded email to the org's chosen inbox (reply-to = the visitor) and an
 * in-app notice to the schedulers. The visitor never learns more than "sent".
 */
const input = z.object({
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2, "Please add your name.").max(120),
  email: z.string().trim().email("That email doesn't look right.").max(120).or(z.literal("")),
  phone: z.string().trim().max(40),
  message: z.string().trim().min(10, "Tell us a little more so we can help.").max(2000),
  /** Honeypot — humans never see it; anything here means a bot. */
  website: z.string().max(200),
});

// Small in-memory damper (per instance): 5 messages/hour per IP+org.
const hits = new Map<string, { n: number; resetAt: number }>();
function limited(key: string): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now > h.resetAt) {
    hits.set(key, { n: 1, resetAt: now + 3_600_000 });
    return false;
  }
  h.n += 1;
  return h.n > 5;
}

export async function submitContactMessage(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  // Bots fill the invisible field — swallow silently so they learn nothing.
  if (d.website) return { ok: true };
  if (!d.email && !d.phone.trim()) return { ok: false, error: "Leave an email or phone number so we can reach you." };

  const db = getDb();
  const [org] = await db.select({ id: orgs.id, name: orgs.name, profile: orgs.profile }).from(orgs).where(eq(orgs.slug, d.slug)).limit(1);
  if (!org) return { ok: false, error: "This page is unavailable." };
  const [page] = await db.select({ on: orgPublicPages.showContactForm, formEmail: orgPublicPages.contactFormEmail, contactEmail: orgPublicPages.contactEmail })
    .from(orgPublicPages).where(eq(orgPublicPages.orgId, org.id)).limit(1);
  if (!page?.on) return { ok: false, error: "This practice isn't accepting messages here right now." };

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "local").split(",")[0]!.trim();
  if (limited(`${ip}:${org.id}`)) return { ok: false, error: "That's a few messages in a row — please give it an hour, or phone the practice." };

  const email = d.email || null;
  const phone = d.phone.trim() || null;

  // 1) Store — the record the org can always find, even if email is dormant.
  await createContactMessage(org.id, { name: d.name, email, phone, message: d.message });

  // 2) In-app notice to the people who handle the front door (admins + front desk).
  const schedulers = await db.select({ userId: orgMembers.userId })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), inArray(orgMembers.teamRole, ["org_admin", "front_desk"]), eq(orgMembers.status, "active")));
  const reach = [email, phone].filter(Boolean).join(" · ");
  for (const s of schedulers) {
    await createNotification({
      userId: s.userId, orgId: org.id, kind: "contact_message",
      title: `New message from ${d.name}`,
      body: `${d.message.slice(0, 140)}${d.message.length > 140 ? "…" : ""}${reach ? ` · ${reach}` : ""}`,
      href: "/hub",
    });
  }

  // 3) Branded email to the org's chosen inbox — reply-to goes straight to the visitor.
  const inbox = page.formEmail || page.contactEmail || (org.profile as Record<string, string> | null)?.email || null;
  if (inbox) {
    try {
      await sendPlatformEmail({
        to: inbox,
        replyTo: email ?? undefined,
        ...contactMessageEmail({ practiceName: org.name, name: d.name, email, phone, message: d.message, inboxUrl: `${APP_URL}/hub` }),
      });
    } catch { /* stored + in-app already — email is best-effort */ }
  }

  return { ok: true };
}
