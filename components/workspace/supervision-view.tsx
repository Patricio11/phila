"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, ClipboardCheck, Clock, RotateCcw, Sparkles, Users } from "lucide-react";
import type { SupervisionItem, SupervisionOverview } from "@/lib/data-provider";
import { Card, CardHead } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CredentialChip } from "@/components/ui/credential-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { signOffNote } from "@/app/app/supervision/actions";
import { cn } from "@/lib/utils";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}
function ago(iso: string, nowISO: string): string {
  const h = Math.round((new Date(nowISO).getTime() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function SupervisionView({ overview, items: initial, nowISO }: { overview: SupervisionOverview; items: SupervisionItem[]; nowISO: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(initial[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={Users} value={overview.supervisees.length} label="Supervisees" />
        <StatCard icon={ClipboardCheck} value={items.length} label="Awaiting sign-off" tone={items.length > 0 ? "warn" : "default"} />
        <StatCard icon={Clock} value={`${overview.avgTurnaroundHours}h`} label="Avg turnaround" />
        <StatCard icon={Check} value={overview.signedThisMonth} label="Signed this month" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Queue */}
        <div className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-3">Notes for sign-off</h2>
          {items.length === 0 ? (
            <Card className="p-2"><EmptyState icon={Check} title="All caught up" body="No supervisee notes are waiting for your sign-off." /></Card>
          ) : (
            items.map((it) => (
              <QueueCard
                key={it.id}
                item={it}
                nowISO={nowISO}
                open={openId === it.id}
                onToggle={() => setOpenId((p) => (p === it.id ? null : it.id))}
                onResolved={() => { setItems((prev) => prev.filter((x) => x.id !== it.id)); toast({ tone: "success", title: "Recorded" }); }}
              />
            ))
          )}
        </div>

        {/* Supervisees */}
        <div>
          <Card>
            <CardHead title="Your supervisees" count={overview.supervisees.length} />
            <div className="space-y-2.5 px-[17px] pb-[17px]">
              {overview.supervisees.length === 0 ? (
                <p className="text-[12.5px] text-text-3">No supervisees assigned yet. The hub assigns supervision.</p>
              ) : (
                overview.supervisees.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5">
                    <Avatar name={s.name} size="sm" verified={s.credential.status === "verified"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-text">{s.name}</div>
                      <div className="flex items-center gap-1.5">
                        <CredentialChip body={s.credential.body} status={s.credential.status} />
                        <span className="text-[11px] text-text-3">{s.caseload} clients</span>
                      </div>
                    </div>
                    {s.pending > 0 && <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warn-soft text-[10.5px] font-semibold text-warn">{s.pending}</span>}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QueueCard({ item, nowISO, open, onToggle, onResolved }: { item: SupervisionItem; nowISO: string; open: boolean; onToggle: () => void; onResolved: () => void }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [comment, setComment] = useState("");

  const act = (decision: "approved" | "changes_requested") => {
    if (decision === "changes_requested" && !comment.trim()) {
      return toast({ tone: "error", title: "Add feedback on what to change first." });
    }
    start(async () => {
      const res = await signOffNote({ itemId: item.id, superviseeId: item.superviseeId, decision, comment: comment.trim() || undefined });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onResolved();
    });
  };

  return (
    <div className={cn("rounded-card border bg-surface transition-colors", item.riskFlagged ? "border-danger/30" : "border-border")}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left">
        <Avatar name={item.superviseeName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13.5px] font-medium text-text">{item.superviseeName}</span>
            <span className="text-text-3">·</span>
            <span className="text-[12.5px] text-text-2">{item.clientName}</span>
            {item.riskFlagged && <Tag tone="danger"><AlertTriangle className="size-3" strokeWidth={2.5} aria-hidden /> Safeguarding</Tag>}
            {item.aiGenerated && <Tag tone="neutral"><Sparkles className="size-3" strokeWidth={2} aria-hidden /> AI-assisted</Tag>}
          </div>
          <div className="mt-0.5 text-[11.5px] text-text-3">{item.serviceName} · {when(item.sessionAt)} · submitted {ago(item.submittedAt, nowISO)}</div>
          {!open && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-text-2">{item.noteExcerpt}</p>}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3.5">
          <div className="rounded-control bg-surface-2/60 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">Clinical note</div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">{item.noteExcerpt}</p>
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Supervision feedback (required when requesting changes)…" className="min-h-[72px]" aria-label="Supervision feedback" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => act("changes_requested")} disabled={pending}>
              <RotateCcw className="size-4" strokeWidth={2} aria-hidden /> Request changes
            </Button>
            <Button size="sm" onClick={() => act("approved")} loading={pending}>
              <Check className="size-4" strokeWidth={2.4} aria-hidden /> Sign off
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
