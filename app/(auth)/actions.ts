"use server";

import { z } from "zod";
import { headers, cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { PROVINCES } from "@/lib/domain/enums";
import { auth } from "@/lib/auth/better-auth";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { TWO_FA_SKIP_COOKIE } from "@/lib/auth/two-factor-prompt";
import { logAccess } from "@/lib/audit";
import { getDb } from "@/db/client";
import { orgMembers, orgs, subscriptions } from "@/db/schema";
import { activateMembershipsDb } from "@/db/queries/team";
import { planById } from "@/lib/billing/plans";

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

/** The dashboard each role lands on. */
async function baseHome(userId: string, platformRole: string | null): Promise<string> {
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

/** Where a user lands after sign-in. The 2FA nudge is a dismissible dashboard banner
 * (see `shouldPromptTwoFactor`), not a redirect — so it never blocks or reroutes. */
async function homeForUser(userId: string, platformRole: string | null): Promise<string> {
  return baseHome(userId, platformRole);
}

/** "Remind me later" on the 2FA banner — remember the choice for two weeks. */
export async function dismissTwoFactorPrompt(): Promise<{ ok: true }> {
  (await cookies()).set(TWO_FA_SKIP_COOKIE, "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 14, path: "/" });
  return { ok: true };
}

export async function signIn(
  raw: z.infer<typeof signInInput>,
): Promise<
  | { ok: true; redirect: string }
  | { ok: true; twoFactor: true }
  | { ok: false; error: string; needsVerification?: true; email?: string }
> {
  const parsed = signInInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };

  let res: { user?: { id: string; platformRole?: string | null }; twoFactorRedirect?: boolean };
  try {
    res = (await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    })) as typeof res;
  } catch (e) {
    // Unverified address: refuse sign-in and guide them to verify (Better Auth also
    // re-sends the verification email on this failed attempt).
    const code = (e as { body?: { code?: string }; status?: number | string })?.body?.code;
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    if (code === "EMAIL_NOT_VERIFIED" || msg.includes("not verified")) {
      return { ok: false, error: "Please verify your email first — we've sent you a fresh link.", needsVerification: true, email: parsed.data.email };
    }
    return { ok: false, error: "Wrong email or password." };
  }

  // 2FA enabled: the session isn't established until the TOTP code is verified.
  if (res.twoFactorRedirect || !res.user) return { ok: true, twoFactor: true };

  // First successful sign-in activates any pending team invite (invited → active).
  await activateMembershipsDb(res.user.id);

  return { ok: true, redirect: await homeForUser(res.user.id, res.user.platformRole ?? null) };
}

/** Resolve the signed-in user's home  used after the 2FA challenge completes. */
export async function homeForCurrentUser(): Promise<{ redirect: string }> {
  const p = await getCurrentPrincipal();
  if (!p) return { redirect: "/login" };
  await activateMembershipsDb(p.userId); // activate a pending invite on first sign-in
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
  /** Optionally carried from a plan choice on the landing page; the trial runs on it. */
  planId: z.string().optional(),
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
 * onboarding. The org starts Dormant-by-Default  every paid feature off.
 */
const TRIAL_DAYS = 17;

export async function registerPractice(
  raw: z.infer<typeof registerInput>,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const parsed = registerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  const { practiceName, name, email, password, province } = parsed.data;
  // Honour a plan chosen on the landing page; otherwise the trial runs on Community.
  const planId = planById(parsed.data.planId ?? "") ? parsed.data.planId! : "p_community";

  let userId: string;
  try {
    // requireEmailVerification is on, so this creates the user + sends the branded
    // verification email (Better Auth `sendOnSignUp`) but establishes NO session.
    const res = await auth.api.signUpEmail({ body: { email, password, name, callbackURL: "/welcome" }, headers: await headers() });
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
    onboardingStatus: "not_started",
  });
  await db.insert(orgMembers).values({ orgId, userId, teamRole: "org_admin", isSupervisor: false });

  // Start the free trial (no card). Access is real from day one; verification just
  // unlocks payouts + funder sharing.
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  await db.insert(subscriptions).values({
    orgId, planId, status: "trialing", currentPeriodEnd: trialEnd, providerRef: "trial", updatedAt: new Date(),
  }).onConflictDoNothing();

  await logAccess({
    action: "admin.action",
    actor: { userId, platformRole: null, teamRole: "org_admin" },
    orgId,
    target: `org:${orgId}`,
    reason: "register_practice",
  });
  return { ok: true, email };
}

/** Resend the verification email (from the "check your email" screen or the login gate). */
export async function resendVerification(raw: { email: string }): Promise<Result> {
  const parsed = emailInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  try {
    await auth.api.sendVerificationEmail({ body: { email: parsed.data.email, callbackURL: "/welcome" }, headers: await headers() });
  } catch {
    // Don't reveal whether the address exists — always report success.
  }
  return { ok: true };
}

const emailInput = z.object({ email: z.string().email("Enter a valid email.") });

/** Send a password-reset email (W2). Always reports success — never reveals whether an account exists. */
export async function requestPasswordReset(raw: z.infer<typeof emailInput>): Promise<Result> {
  const parsed = emailInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  try {
    await auth.api.requestPasswordReset({ body: { email: parsed.data.email, redirectTo: "/reset-password" }, headers: await headers() });
  } catch {
    // Swallow — don't leak account existence via error/timing shape.
  }
  return { ok: true };
}

const resetInput = z.object({
  token: z.string().min(1, "This reset link is invalid or has expired."),
  password: z.string().min(8, "Use at least 8 characters."),
  confirm: z.string().min(1),
});

/** Exchange a single-use reset token for a new password (W2, Better Auth). */
export async function resetPassword(raw: z.infer<typeof resetInput>): Promise<Result> {
  const parsed = resetInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.password !== parsed.data.confirm) return { ok: false, error: "The passwords don't match." };
  try {
    await auth.api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token }, headers: await headers() });
  } catch {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }
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
