"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { PROVINCES } from "@/lib/domain/enums";
import { auth } from "@/lib/auth/better-auth";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { logAccess } from "@/lib/audit";
import { getDb } from "@/db/client";
import { orgMembers, orgs } from "@/db/schema";

/**
 * Auth flows. Sign-in is **real** (Better Auth) as of Phase 9; the rest validate
 * shape and return success until their phase wires them (sign-up Phase 9 finishes,
 * reset Phase 12). The session cookie is set by Better Auth's nextCookies plugin.
 */
type Result = { ok: true } | { ok: false; error: string };

const signInInput = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

/** Where each role lands after sign-in. */
async function homeForUser(userId: string, platformRole: string | null): Promise<string> {
  if (platformRole === "client") return "/me";
  if (platformRole === "funder") return "/funder";
  if (platformRole === "super_admin") return "/admin";
  const db = getDb();
  const [m] = await db
    .select({ role: orgMembers.teamRole })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);
  return m?.role === "org_admin" ? "/hub" : "/app";
}

export async function signIn(
  raw: z.infer<typeof signInInput>,
): Promise<{ ok: true; redirect: string } | { ok: true; twoFactor: true } | { ok: false; error: string }> {
  const parsed = signInInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };

  let res: { user?: { id: string; platformRole?: string | null }; twoFactorRedirect?: boolean };
  try {
    res = (await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    })) as typeof res;
  } catch {
    return { ok: false, error: "Wrong email or password." };
  }

  // 2FA enabled: the session isn't established until the TOTP code is verified.
  if (res.twoFactorRedirect || !res.user) return { ok: true, twoFactor: true };

  return { ok: true, redirect: await homeForUser(res.user.id, res.user.platformRole ?? null) };
}

/** Resolve the signed-in user's home — used after the 2FA challenge completes. */
export async function homeForCurrentUser(): Promise<{ redirect: string }> {
  const p = await getCurrentPrincipal();
  if (!p) return { redirect: "/login" };
  if (p.platformRole === "client") return { redirect: "/me" };
  if (p.platformRole === "funder") return { redirect: "/funder" };
  if (p.platformRole === "super_admin") return { redirect: "/admin" };
  return { redirect: p.memberships[0]?.teamRole === "org_admin" ? "/hub" : "/app" };
}

const registerInput = z.object({
  practiceName: z.string().min(2, "Enter your practice name."),
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  province: z.enum(PROVINCES),
  agree: z.literal(true, { message: "Please accept the terms to continue." }),
});

const DEFAULT_HOURS = {
  1: { start: "08:00", end: "17:00" },
  2: { start: "08:00", end: "17:00" },
  3: { start: "08:00", end: "17:00" },
  4: { start: "08:00", end: "17:00" },
  5: { start: "08:00", end: "17:00" },
  6: null,
  7: null,
};

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "practice";
}

async function uniqueSlug(db: ReturnType<typeof getDb>, base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.slug, slug)).limit(1);
    if (!hit) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * Practice sign-up (Phase 9). Creates the **first org_admin** (Better Auth, which
 * also signs them in) and their **org** + membership, then the form routes to
 * onboarding. The org starts Dormant-by-Default — every paid feature off.
 */
export async function registerPractice(raw: z.infer<typeof registerInput>): Promise<Result> {
  const parsed = registerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  const { practiceName, name, email, password, province } = parsed.data;

  let userId: string;
  try {
    const res = await auth.api.signUpEmail({ body: { email, password, name }, headers: await headers() });
    userId = res.user.id;
  } catch {
    return { ok: false, error: "That email may already be registered. Try signing in." };
  }

  const db = getDb();
  const slug = await uniqueSlug(db, slugify(practiceName));
  const orgId = `org_${slug.replace(/-/g, "_")}`;
  await db.insert(orgs).values({
    id: orgId,
    name: practiceName,
    slug,
    province,
    brandAccent: "#1C7D58",
    timezone: "Africa/Johannesburg",
    features: { ai: false, video: false, whatsapp: false, sms: false, payments: false },
    scheduling: { defaultDurationMin: 60, bufferMin: 10, businessHours: DEFAULT_HOURS },
  });
  await db.insert(orgMembers).values({ orgId, userId, teamRole: "org_admin", isSupervisor: false });

  await logAccess({
    action: "admin.action",
    actor: { userId, platformRole: null, teamRole: "org_admin" },
    orgId,
    target: `org:${orgId}`,
    reason: "register_practice",
  });
  return { ok: true };
}

const emailInput = z.object({ email: z.string().email("Enter a valid email.") });

export async function requestPasswordReset(raw: z.infer<typeof emailInput>): Promise<Result> {
  const parsed = emailInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  return { ok: true };
}

const resetInput = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
  confirm: z.string().min(1),
});

export async function resetPassword(raw: z.infer<typeof resetInput>): Promise<Result> {
  const parsed = resetInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.password !== parsed.data.confirm) return { ok: false, error: "The passwords don't match." };
  return { ok: true };
}

export async function completeOnboarding(): Promise<Result> {
  return { ok: true };
}

const activateInput = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
  confirm: z.string().min(1),
});

/** A client (or invited team member) sets their password from an invite link (mock). */
export async function activateAccount(raw: z.infer<typeof activateInput>): Promise<Result> {
  const parsed = activateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.password !== parsed.data.confirm) return { ok: false, error: "The passwords don't match." };
  return { ok: true };
}
