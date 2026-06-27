"use client";

import { useState, useTransition } from "react";
import { Check, GitMerge, Users2 } from "lucide-react";
import type { DuplicateGroup } from "@/lib/data-provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { mergeClients } from "@/app/hub/clients/actions";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "short", year: "numeric" }).format(new Date(iso));
}

export function DedupeBanner({ groups: initial }: { groups: DuplicateGroup[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState(initial);
  const [keepBy, setKeepBy] = useState<Record<number, string>>(() => Object.fromEntries(initial.map((g, i) => [i, g.clients[0]?.id ?? ""])));
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const [, start] = useTransition();

  if (groups.length === 0) return null;

  const merge = (group: DuplicateGroup, idx: number) => {
    const keepId = keepBy[idx] ?? group.clients[0]!.id;
    const mergeIds = group.clients.filter((c) => c.id !== keepId).map((c) => c.id);
    setPendingIdx(idx);
    start(async () => {
      const res = await mergeClients({ keepId, mergeIds });
      setPendingIdx(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const keptName = group.clients.find((c) => c.id === keepId)?.name ?? "record";
      setGroups((prev) => prev.filter((g) => g !== group));
      toast({ tone: "success", title: "Records merged", description: `${mergeIds.length + 1} records combined into one — ${keptName.split(" ")[0]}'s history is intact.` });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-card border border-warn/30 bg-warn-soft/50 px-4 py-3 text-left transition-colors hover:bg-warn-soft"
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-chip bg-warn-soft text-warn">
          <Users2 className="size-[18px]" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-[600] text-text">{groups.length} possible duplicate{groups.length === 1 ? "" : "s"} to review</div>
          <div className="text-[12px] text-text-2">Same person captured more than once — review and merge so reporting stays accurate.</div>
        </div>
        <span className="shrink-0 text-[12.5px] font-medium text-accent">Review</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Review duplicates" description="Choose the record to keep — its history is preserved and the others fold into it.">
        <div className="space-y-4">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Check className="size-8 text-accent" strokeWidth={2} aria-hidden />
              <p className="text-[13px] text-text-2">All tidy — no duplicates left.</p>
            </div>
          ) : (
            groups.map((group, idx) => {
              const keepId = keepBy[idx] ?? group.clients[0]!.id;
              return (
                <div key={group.clients.map((c) => c.id).join("-")} className="rounded-card border border-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Tag tone="warn">{group.reason}</Tag>
                    <span className="text-[11.5px] text-text-3">Keep one</span>
                  </div>
                  <div className="space-y-1.5">
                    {group.clients.map((c) => {
                      const chosen = c.id === keepId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setKeepBy((prev) => ({ ...prev, [idx]: c.id }))}
                          className={cn("flex w-full items-center gap-2.5 rounded-control border p-2.5 text-left transition-colors", chosen ? "border-accent bg-accent-soft/50" : "border-border hover:bg-surface-hover")}
                        >
                          <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", chosen ? "border-accent bg-accent text-accent-ink" : "border-border-strong")}>
                            {chosen && <Check className="size-3" strokeWidth={3} aria-hidden />}
                          </span>
                          <Avatar name={c.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-text">{c.name}</div>
                            <div className="truncate text-[11.5px] text-text-3">{[c.phone, c.email].filter(Boolean).join(" · ") || "no contact details"}</div>
                          </div>
                          <div className="shrink-0 text-right text-[11px] text-text-3">
                            <div>{c.sessions} session{c.sessions === 1 ? "" : "s"}</div>
                            <div>since {shortDate(c.createdAt)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex justify-end">
                    <Button size="sm" onClick={() => merge(group, idx)} loading={pendingIdx === idx}>
                      <GitMerge className="size-4" strokeWidth={2} aria-hidden /> Merge {group.clients.length} into one
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Dialog>
    </>
  );
}
