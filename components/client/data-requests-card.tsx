"use client";

import { useState, useTransition } from "react";
import { Check, FileDown, ShieldQuestion, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { requestMyData } from "@/app/me/profile/actions";

/**
 * Phase 31.1 — the client's own data rights, stated plainly. Requests route to
 * the practice (the responsible party under POPIA); nothing changes until they
 * action it. Calm, no legalese, no extra steps for anyone.
 */
export function DataRequestsCard() {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [sent, setSent] = useState<"export" | "deletion" | null>(null);

  const request = (kind: "export" | "deletion") => start(async () => {
    const res = await requestMyData({ kind });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setSent(kind);
    setConfirmDeletion(false);
    toast({ tone: "success", title: kind === "export" ? "Request sent" : "Deletion request sent", description: "Your practice has been notified and will come back to you." });
  });

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[13.5px] font-[600] text-text">
        <ShieldQuestion className="size-4 text-accent" strokeWidth={2} aria-hidden /> Your data, your rights
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">
        You can ask for a copy of everything your practice holds about you, or ask for your information to be deleted. Your practice handles the request — some clinical records must be kept for a legally set time, and they&apos;ll tell you honestly if that applies.
      </p>
      {sent ? (
        <div className="mt-3 flex items-start gap-2 rounded-control border border-border bg-surface-2/50 px-3 py-2.5 text-[12.5px] text-text-2">
          <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.4} aria-hidden />
          <span>Your {sent === "export" ? "data-copy" : "deletion"} request has been sent to the practice.</span>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => request("export")} loading={pending}>
            <FileDown className="size-3.5" strokeWidth={2} aria-hidden /> Request a copy of my data
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirmDeletion(true)}>
            <Trash2 className="size-3.5" strokeWidth={2} aria-hidden /> Request deletion
          </Button>
        </div>
      )}

      <Dialog
        open={confirmDeletion}
        onClose={() => setConfirmDeletion(false)}
        title="Request deletion of your data"
        description="Your practice will remove your personal details wherever the law allows. Clinical records sometimes have to be kept for a set period — they'll let you know exactly what applies to you."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDeletion(false)} disabled={pending}>Not now</Button>
            <Button onClick={() => request("deletion")} loading={pending}>Send the request</Button>
          </div>
        }
      >
        <p className="text-[13px] text-text-2">This sends the request to your practice — nothing is deleted until they process it and confirm with you.</p>
      </Dialog>
    </div>
  );
}
