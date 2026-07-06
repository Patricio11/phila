import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { planById } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Create your practice · Phila", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  // A plan chosen on the landing page (?plan=…) carries into the trial + is shown here.
  const { plan: planParam } = await searchParams;
  const plan = planById(planParam ?? "");

  return (
    <AuthShell
      title="Create your practice"
      subtitle="A few details to get started  you'll finish setting up in a moment."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link></>}
    >
      <SignupForm planId={plan?.id ?? null} planName={plan?.name ?? null} />
    </AuthShell>
  );
}
