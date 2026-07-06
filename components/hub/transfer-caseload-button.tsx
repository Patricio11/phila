"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { transferCaseload } from "@/app/hub/team/actions";

/**
 * Transfer a leaving counsellor's whole caseload to a colleague (Phase 18.8) —
 * one pick, one confirm. Clients + upcoming sessions move; every past session,
 * note, and outcome stays exactly where it happened.
 */
export function TransferCaseloadButton({
  fromCounsellorId,
  fromName,
  caseloadCount,
  counsellors,
}: {
  fromCounsellorId: string;
  fromName: string;
  caseloadCount: number;
  counsellors: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toId, setToId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const targets = counsellors.filter((c) => c.id !== fromCounsellorId);
  const toName = targets.find((c) => c.id === toId)?.name ?? "";

  const submit = () => {
    if (!toId) return;
    start(async () => {
      const res = await transferCaseload({ fromCounsellorId, toCounsellorId: toId });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const clashes = res.skippedSessions > 0 ? ` ${res.skippedSessions} session${res.skippedSessions === 1 ? "" : "s"} clashed with ${toName.split(" ")[0]}'s diary — reschedule those.` : "";
      toast({
        tone: "success",
        title: `Caseload transferred to ${toName.split(" ")[0]}`,
        description: `${res.clients} client${res.clients === 1 ? "" : "s"} + ${res.movedSessions} upcoming session${res.movedSessions === 1 ? "" : "s"} moved. All history stays intact.${clashes}`,
      });
      setOpen(false);
      setToId(null);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="size-4" strokeWidth={2} aria-hidden /> Transfer all
      </Button>

      <Dialog
        open={open}
        onClose={() => { if (!pending) { setOpen(false); setToId(null); } }}
        title="Transfer caseload"
        description={`Move all of ${fromName.split(" ")[0]}'s clients to another counsellor — e.g. when an internship or contract ends.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); setToId(null); }} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending} disabled={!toId}>
              Transfer {caseloadCount} client{caseloadCount === 1 ? "" : "s"}{toName ? ` to ${toName.split(" ")[0]}` : ""}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Receiving counsellor</Label>
            <SearchSelect
              value={toId}
              onChange={setToId}
              options={targets.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Choose who takes over"
              searchPlaceholder="Search counsellors…"
              ariaLabel="Receiving counsellor"
            />
          </div>

          <ul className="space-y-1.5 rounded-control border border-border bg-surface-2/40 p-3 text-[12.5px] text-text-2">
            <li>• All <b className="text-text">{caseloadCount} active client{caseloadCount === 1 ? "" : "s"}</b> get {toName ? toName.split(" ")[0] : "the new counsellor"} as their primary counsellor.</li>
            <li>• <b className="text-text">Upcoming sessions</b> move to their diary (any that clash are kept aside for you to reschedule).</li>
            <li>• They&apos;re notified in-app with the handover summary.</li>
          </ul>

          <p className="flex items-start gap-2 rounded-control border border-accent/25 bg-accent-soft/20 px-3 py-2.5 text-[12px] text-text-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
            Nothing historical changes: past sessions, notes, outcomes, and documents stay exactly as they were recorded.
          </p>
        </div>
      </Dialog>
    </>
  );
}
