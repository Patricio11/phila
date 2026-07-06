"use client";

import { useState, useTransition } from "react";
import { Check, Download, FileCheck2, FileX2, RotateCcw } from "lucide-react";
import type { OnboardingDocStatus, OrgOnboardingDoc } from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { reviewOnboardingDoc, signAdminOnboardingDoc } from "@/app/admin/orgs/actions";
import { cn } from "@/lib/utils";

const STATUS: Record<OnboardingDocStatus, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "bg-accent-soft text-accent" },
  pending: { label: "Awaiting review", cls: "bg-warn-soft text-warn" },
  rejected: { label: "Sent back", cls: "bg-danger-soft text-danger" },
  missing: { label: "Not uploaded", cls: "bg-surface-2 text-text-3" },
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

export function OrgDocReview({ orgId, docs: initial }: { orgId: string; docs: OrgOnboardingDoc[] }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [, start] = useTransition();

  const decide = (requirementId: string, decision: "verify" | "reject", reviewNote?: string) => {
    setPendingId(requirementId);
    start(async () => {
      const res = await reviewOnboardingDoc({ orgId, requirementId, decision, note: reviewNote });
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setDocs((prev) => prev.map((d) => (d.requirementId === requirementId ? { ...d, status: decision === "verify" ? "verified" : "rejected" } : d)));
      setRejecting(null); setNote("");
      toast({ tone: decision === "verify" ? "success" : "default", title: decision === "verify" ? "Document verified" : "Sent back to the practice", description: "Recorded in the audit ledger." });
    });
  };

  const download = async (requirementId: string) => {
    const res = await signAdminOnboardingDoc({ orgId, requirementId });
    if (!res.ok) return toast({ tone: "error", title: "Can't open this", description: res.error });
    window.open(res.url, "_blank", "noopener");
  };

  return (
    <ul className="space-y-2">
      {docs.map((d) => {
        const s = STATUS[d.status];
        const busy = pendingId === d.requirementId;
        return (
          <li key={d.requirementId} className="rounded-control border border-border p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", d.status === "verified" ? "bg-accent-soft text-accent" : d.status === "rejected" ? "bg-danger-soft text-danger" : "bg-surface-2 text-text-3")}>
                {d.status === "rejected" ? <FileX2 className="size-[18px]" strokeWidth={2} aria-hidden /> : <FileCheck2 className="size-[18px]" strokeWidth={2} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13.5px] font-medium text-text">{d.label}</span>
                  {!d.required && <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-3">Optional</span>}
                </div>
                <div className="text-[11.5px] text-text-3">{d.fileName ? <>{d.fileName} · {ago(d.uploadedAt)}</> : "Nothing uploaded yet"}</div>
              </div>
              <span className={cn("shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold", s.cls)}>{s.label}</span>
              {d.fileName ? (
                <div className="flex w-full justify-end gap-1.5 sm:w-auto">
                  <Button variant="mini" onClick={() => download(d.requirementId)}>
                    <Download className="size-3.5" strokeWidth={2} aria-hidden /> Open
                  </Button>
                  {(d.status === "pending" || d.status === "rejected") && (
                    <>
                      {d.status !== "rejected" && (
                        <Button variant="mini" disabled={busy} onClick={() => { setRejecting(rejecting === d.requirementId ? null : d.requirementId); setNote(""); }}>
                          <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden /> Send back
                        </Button>
                      )}
                      <Button variant="mini" disabled={busy} onClick={() => decide(d.requirementId, "verify")}>
                        <Check className="size-3.5" strokeWidth={2.2} aria-hidden /> Verify
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {rejecting === d.requirementId && (
              <div className="mt-3 flex flex-col gap-2 rounded-control bg-surface-2/50 p-2.5 sm:flex-row sm:items-center">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs fixing? (the practice sees this)" className="flex-1" />
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => { setRejecting(null); setNote(""); }}>Cancel</Button>
                  <Button size="sm" disabled={busy || note.trim().length < 3} onClick={() => decide(d.requirementId, "reject", note.trim())}>Send back</Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
