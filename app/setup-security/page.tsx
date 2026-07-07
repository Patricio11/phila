import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { SecurityPrompt } from "@/components/auth/security-prompt";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Secure your account · Phila", robots: { index: false, follow: false } };

/**
 * The skippable 2FA prompt (W2). Reached right after sign-in for privileged users
 * without 2FA. Guarded so it never shows to someone who already has 2FA on.
 */
export default async function SetupSecurityPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const principal = await getCurrentPrincipal();
  if (!principal) redirect("/login");

  const { next } = await searchParams;
  const home = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  // Already protected — don't nag; go where they were headed.
  if (principal.twoFactorEnabled) redirect(home);

  const first = principal.name.trim().split(/\s+/)[0] || "there";
  return <SecurityPrompt next={home} first={first} />;
}
