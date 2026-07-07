"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, X } from "lucide-react";
import { dismissTwoFactorPrompt } from "@/app/(auth)/actions";

/**
 * The skippable 2FA nudge (W2) — a calm dashboard banner for privileged users who
 * haven't enabled two-factor. Never blocks: "Set it up" opens the focused setup page;
 * "×" remembers the dismissal for two weeks. Rendered by the app shell.
 */
export function TwoFactorBanner() {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [, start] = useTransition();

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    start(async () => { await dismissTwoFactorPrompt(); router.refresh(); });
  };

  return (
    <div className="flex items-center gap-3 border-b border-warn/20 bg-warn-soft/40 px-4 py-2.5 sm:px-6">
      <ShieldCheck className="size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-text-2">
        <span className="font-medium text-text">Protect your account with two-factor authentication.</span>{" "}
        <span className="hidden sm:inline">Your account can reach client records — it takes about a minute.</span>
      </p>
      <Link href="/setup-security" className="shrink-0 rounded-control bg-warn/10 px-2.5 py-1 text-[12px] font-medium text-warn transition-colors hover:bg-warn/20">
        Set it up
      </Link>
      <button type="button" onClick={dismiss} aria-label="Remind me later" className="grid size-6 shrink-0 place-items-center rounded-control text-text-3 transition-colors hover:bg-warn-soft hover:text-text">
        <X className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
