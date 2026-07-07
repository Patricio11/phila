"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PhilaMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { dismissTwoFactorPrompt } from "@/app/(auth)/actions";

/**
 * Post-sign-in 2FA nudge (W2) — shown to privileged users who haven't enabled it.
 * Never blocks: enrol now with the reusable TwoFactorSetup, or "remind me later"
 * (remembers the choice for two weeks) and go straight to the dashboard.
 */
export function SecurityPrompt({ next, first }: { next: string; first: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const later = () => start(async () => {
    await dismissTwoFactorPrompt();
    router.push(next);
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-2/30 px-5 py-10">
      <div className="rise w-full max-w-md rounded-card border border-border bg-surface p-7 shadow-sm sm:p-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-2.5" aria-label="Phila home">
          <PhilaMark size={26} />
          <span className="text-[16px] font-[680] tracking-[-0.02em] text-text">Phila</span>
        </Link>

        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ShieldCheck className="size-6" strokeWidth={2} aria-hidden />
        </span>

        <h1 className="text-[20px] font-[700] tracking-[-0.02em] text-text">Add an extra layer of security, {first}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">
          Your account can reach client records, so we strongly recommend two-factor authentication. It takes about a minute with any authenticator app — and you can always set it up later from Settings.
        </p>

        <div className="mt-5">
          <TwoFactorSetup enabled={false} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <button type="button" onClick={later} disabled={pending} className="text-[13px] font-medium text-text-3 transition-colors hover:text-text disabled:opacity-50">
            Remind me later
          </button>
          <Button onClick={() => router.push(next)} variant="ghost">
            Continue to dashboard <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
