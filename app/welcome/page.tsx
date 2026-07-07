import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { PhilaMark } from "@/components/brand/logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome to Phila", robots: { index: false, follow: false } };

/**
 * Post-verification landing (W1.8). Better Auth verifies the email, auto-signs the
 * user in, and redirects here. We greet them, confirm the trial is live, and send
 * them into the hub  where the "complete your company profile" step awaits.
 */
export default async function WelcomePage() {
  const principal = await getCurrentPrincipal();
  // If the auto sign-in didn't take (e.g. link opened in another browser), send them
  // to sign in  their email is now verified so it'll work.
  if (!principal) redirect("/login?verified=1");

  const first = (principal.name ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-2/30 px-5 py-10">
      <div className="rise w-full max-w-md rounded-card border border-border bg-surface p-7 text-center shadow-sm sm:p-9">
        <Link href="/" className="mb-6 inline-flex items-center gap-2.5" aria-label="Phila home">
          <PhilaMark size={26} />
          <span className="text-[16px] font-[680] tracking-[-0.02em] text-text">Phila</span>
        </Link>

        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CheckCircle2 className="size-7" strokeWidth={2} aria-hidden />
        </span>

        <h1 className="text-[22px] font-[700] tracking-[-0.02em] text-text">You&apos;re in, {first} 🎉</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-text-2">
          Your email is verified and your <span className="font-medium text-text">17-day free trial</span> is live  no card needed. Take a look around, then complete your company profile to go fully live.
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-control bg-surface-2/60 px-4 py-3 text-left">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-text-2">
            Next: invite your team, set up rooms &amp; services, and complete your <span className="font-medium text-text">company verification</span> to unlock payouts and funder reporting.
          </p>
        </div>

        <Link
          href="/hub"
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-control bg-accent px-5 py-3 text-[14px] font-[600] text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Enter your dashboard <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
