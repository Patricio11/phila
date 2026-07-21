"use client";

import { useState, useTransition } from "react";
import { Download, Gavel, ShieldAlert, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { exportDataSubject, eraseDataSubject, setLegalHold } from "@/app/hub/clients/dsar-actions";
import { cn } from "@/lib/utils";

/**
 * Phase 31.1 — the quiet "Data & privacy" panel on the client detail. View-first,
 * used only when someone asks: the retention clock is computed and shown (never
 * configured), Export answers a POPIA access request in one click, and Handle
 * deletion runs the honoured-where-lawful erasure with a typed confirmation.
 */
export function DataPrivacyCard({
  clientId,
  clientName,
  retentionLabel,
  legalHold,
  legalHoldReason,
}: {
  clientId: string;
  clientName: string;
  retentionLabel: string;
  legalHold: boolean;
  legalHoldReason: string | null;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [eraseOpen, setEraseOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [holdReason, setHoldReason] = useState(legalHoldReason ?? "");
  const [outcome, setOutcome] = useState<string | null>(null);

  const doExport = () => start(async () => {
    const res = await exportDataSubject({ clientId });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data-export-${clientName.toLowerCase().replace(/\s+/g, "-")}-${res.data.generatedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ tone: "success", title: "Export downloaded", description: "Everything held on this person, in one portable file. The export was audited." });
  });

  const doErase = () => start(async () => {
    const res = await eraseDataSubject({ clientId, confirmName, expectedName: clientName });
    setOutcome(res.message);
    if (res.ok) toast({ tone: "success", title: "Deletion request actioned", description: "Identifiers removed; the record is closed." });
    else toast({ tone: "default", title: "Request recorded", description: res.message });
  });

  const toggleHold = () => start(async () => {
    const res = await setLegalHold({ clientId, on: !legalHold, reason: holdReason });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setHoldOpen(false);
    toast({ tone: "success", title: legalHold ? "Legal hold lifted" : "Legal hold set", description: legalHold ? "Retention rules apply again." : "Erasure and pruning are blocked while the hold stands." });
  });

  return (
    <div className="space-y-3 px-[17px] pb-[17px]">
      {/* Retention — computed, never configured. */}
      <div className="flex items-start gap-2.5 rounded-control border border-border bg-surface-2/40 px-3 py-2.5">
        <Timer className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <div className="text-[12px] font-[620] text-text">Record retention</div>
          <p className="text-[11.5px] leading-snug text-text-2">{retentionLabel}</p>
          <p className="mt-0.5 text-[10.5px] text-text-3">Set automatically by HPCSA rules — nothing to configure.</p>
        </div>
      </div>

      {legalHold && (
        <div className="flex items-start gap-2.5 rounded-control border border-warn/30 bg-warn-soft px-3 py-2.5">
          <Gavel className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden />
          <p className="text-[11.5px] leading-snug text-warn">Legal hold — erasure and pruning are blocked.{legalHoldReason ? ` ${legalHoldReason}` : ""}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={doExport} loading={pending}>
          <Download className="size-3.5" strokeWidth={2} aria-hidden /> Export data
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setConfirmName(""); setOutcome(null); setEraseOpen(true); }}>
          <ShieldAlert className="size-3.5" strokeWidth={2} aria-hidden /> Handle deletion request
        </Button>
        <Button variant="ghost" size="sm" className={cn(legalHold && "text-warn hover:text-warn")} onClick={() => setHoldOpen(true)}>
          <Gavel className="size-3.5" strokeWidth={2} aria-hidden /> {legalHold ? "Lift legal hold" : "Legal hold"}
        </Button>
      </div>

      {/* Deletion request — honoured where lawful, honest where retention is mandated. */}
      <Dialog
        open={eraseOpen}
        onClose={() => setEraseOpen(false)}
        title="Handle a deletion request"
        description="Identifiers are removed and the record is closed. Where HPCSA retention still applies, the clinical record is kept under its clock and destroyed when it lapses — the reason is shown so you can pass it to the requester."
        footer={
          outcome ? (
            <div className="flex justify-end"><Button variant="ghost" onClick={() => setEraseOpen(false)}>Close</Button></div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEraseOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={doErase} loading={pending} disabled={confirmName.trim() !== clientName.trim()} className="bg-danger hover:bg-danger/90">Action the request</Button>
            </div>
          )
        }
      >
        {outcome ? (
          <p className="text-[13.5px] leading-relaxed text-text-2">{outcome}</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="dsar-confirm">Type the client&apos;s full name to confirm</Label>
            <Input id="dsar-confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={clientName} autoFocus />
            <p className="text-[11.5px] text-text-3">This de-identifies the record immediately and cannot be undone. The action is audited.</p>
          </div>
        )}
      </Dialog>

      {/* Legal hold */}
      <Dialog
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        title={legalHold ? "Lift the legal hold" : "Place a legal hold"}
        description={legalHold ? "Retention rules and deletion requests apply again once lifted." : "While a hold stands, this record cannot be erased or pruned — for litigation, an inquiry, or a regulator request."}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setHoldOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={toggleHold} loading={pending}>{legalHold ? "Lift hold" : "Set hold"}</Button>
          </div>
        }
      >
        {!legalHold && (
          <div className="space-y-2">
            <Label htmlFor="hold-reason">Reason (kept on the record)</Label>
            <Textarea id="hold-reason" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={2} placeholder="e.g. Subpoena ref 12/2026 — hold until resolved" />
          </div>
        )}
      </Dialog>
    </div>
  );
}
