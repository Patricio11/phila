"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { markIoRegistered } from "@/app/hub/settings/actions";

/**
 * Phase 31.5 - a gentle, dismissible Information-Officer nudge. POPIA requires
 * every responsible party to register an IO with the Information Regulator; this
 * is a one-link reminder with a "done" tick - never mandatory, never blocking.
 */
export function IoNudge({ registered }: { registered: boolean }) {
  const { toast } = useToast();
  const [done, setDone] = useState(registered);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="flex items-center gap-2.5 rounded-control border border-border bg-surface-2/40 px-3 py-2.5 text-[12.5px] text-text-2">
        <Check className="size-4 shrink-0 text-accent" strokeWidth={2.4} aria-hidden />
        Information Officer registered with the Information Regulator.
      </div>
    );
  }

  const mark = () => start(async () => {
    const res = await markIoRegistered();
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setDone(true);
    toast({ tone: "success", title: "Noted", description: "Marked as registered - it'll stop reminding you." });
  });

  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-info/25 bg-info-soft/40 px-3.5 py-3 sm:flex-row sm:items-center">
      <UserCheck className="size-4 shrink-0 text-info" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-[620] text-text">Register your Information Officer</div>
        <p className="text-[11.5px] leading-snug text-text-2">POPIA asks every practice to register an Information Officer (usually the practice head) with the Information Regulator - a once-off online form.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <a href="https://justice.gov.za/inforeg/portal.html" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden /> Regulator portal
          </a>
        </Button>
        <Button size="sm" onClick={mark} loading={pending}><Check className="size-3.5" strokeWidth={2.4} aria-hidden /> Done</Button>
      </div>
    </div>
  );
}
