"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { PROVINCES } from "@/lib/domain/enums";
import { auth } from "@/lib/auth/better-auth";
import { getDb } from "@/db/client";
import { orgMembers } from "@/db/schema";

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
): Promise<{ ok: true; redirect: string } | { ok: false; error: string }> {
  const parsed = signInInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };

  let user: { id: string; platformRole?: string | null };
  try {
    const res = await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
    user = res.user as typeof user;
  } catch {
    return { ok: false, error: "Wrong email or password." };
  }

  return { ok: true, redirect: await homeForUser(user.id, user.platformRole ?? null) };
}

const registerInput = z.object({
  practiceName: z.string().min(2, "Enter your practice name."),
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  province: z.enum(PROVINCES),
  agree: z.literal(true, { message: "Please accept the terms to continue." }),
});

export async function registerPractice(raw: z.infer<typeof registerInput>): Promise<Result> {
  const parsed = registerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
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
