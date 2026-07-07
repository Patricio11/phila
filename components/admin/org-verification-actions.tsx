"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { approveOrg, sendBackOnboarding } from "@/app/admin/orgs/actions";

/**
 * Org-level verification decision (W1.8c). Shown once a practice has submitted:
 * approve (→ verified + approval email) or send the whole application back for
 * changes (→ action_needed + action-needed email).
 */
export function OrgVerificationActions({ orgId, status }: { orgId: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState("");

  if (status === "not_started") {
    return <p className="text-[12.5px] text-text-3">This practice hasn&apos;t submitted its verification yet.</p>;
  }

  const approve = () => start(async () => {
    const res = await approveOrg({ orgId });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Practice verified", description: "An approval email is on its way." });
    router.refresh();
  });

  const back = () => start(async () => {
    const res = await sendBackOnboarding({ orgId, reason: reason.trim() || undefined });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "default", title: "Sent back", description: "The practice has been emailed what to fix." });
    setSendingBack(false); setReason("");
    router.refresh();
  });

  if (status === "verified") {
    return (
      <div className="flex items-center gap-2 text-[13px] font-medium text-accent">
        <BadgeCheck className="size-4.5" strokeWidth={2} aria-hidden /> Verified  payouts &amp; funder sharing unlocked.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={approve} loading={pending}>
          <ShieldCheck className="size-4" strokeWidth={2} aria-hidden /> Approve &amp; verify
        </Button>
        <Button variant="ghost" onClick={() => setSendingBack((v) => !v)} disabled={pending}>
          <RotateCcw className="size-4" strokeWidth={2} aria-hidden /> Send back for changes
        </Button>
      </div>
      {sendingBack && (
        <div className="flex flex-col gap-2 rounded-control bg-surface-2/50 p-3 sm:flex-row sm:items-center">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What should they fix? (they'll get this in an email)" className="flex-1" />
          <Button size="sm" onClick={back} loading={pending}>Send back</Button>
        </div>
      )}
    </div>
  );
}
