"use server";

import { z } from "zod";
import { PROVINCES } from "@/lib/domain/enums";

/**
 * Auth flows (mock). Part A validates shape and returns success so the screens
 * are fully clickable; **no account is created, no email is sent, no session is
 * issued** — that's Phase 9 (Supabase Auth + TOTP + the consent gate), behind
 * these exact screens. Honest by default.
 */
type Result = { ok: true } | { ok: false; error: string };

const signInInput = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(raw: z.infer<typeof signInInput>): Promise<Result> {
  const parsed = signInInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  return { ok: true };
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
