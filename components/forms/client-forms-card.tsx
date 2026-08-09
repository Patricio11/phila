"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardList, Clock } from "lucide-react";
import type { FormField } from "@/lib/domain/types";
import { Card, CardHead } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ResponseView, scaleTotal } from "@/components/forms/response-view";

export interface ClientFormRow {
  id: string;
  title: string;
  status: string;
  sentAt: string;
  submittedAt: string | null;
  snapshot: { title: string; fields: unknown[] };
  answers: Record<string, string> | null;
}

const DAY = (iso: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/**
 * Batch 2l - the forms on a client's record. A completed one opens in full
 * (rendered from its snapshot, so it reads exactly as it was asked); one still
 * out shows honestly as waiting. Used on the counsellor dossier and the hub.
 */
export function ClientFormsCard({ rows }: { rows: ClientFormRow[] }) {
  const [open, setOpen] = useState<ClientFormRow | null>(null);
  if (rows.length === 0) return null;
  const done = rows.filter((r) => r.status === "completed");

  return (
    <Card>
      <CardHead title="Forms" count={done.length} />
      <div className="space-y-2 px-[17px] pb-[17px]">
        {rows.map((r) => {
          const completed = r.status === "completed" && r.answers;
          const fields = (r.snapshot.fields ?? []) as FormField[];
          const total = completed ? scaleTotal(fields, r.answers!) : null;
          return completed ? (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpen(r)}
              className="flex w-full items-center gap-3 rounded-control border border-border p-2.5 text-left transition-colors hover:bg-surface-hover"
            >
              <CheckCircle2 className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-text">{r.title}</div>
                <div className="text-[11.5px] text-text-3">Completed {DAY(r.submittedAt ?? r.sentAt)}</div>
              </div>
              {total && <span className="shrink-0 rounded-chip bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-text-2">Score {total.total}</span>}
            </button>
          ) : (
            <div key={r.id} className="flex items-center gap-3 rounded-control border border-dashed border-border p-2.5">
              <Clock className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-text-2">{r.title}</div>
                <div className="text-[11.5px] text-text-3">Sent {DAY(r.sentAt)} · waiting on the client</div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title ?? "Response"}
        description={open ? `Completed ${DAY(open.submittedAt ?? open.sentAt)}` : undefined}
        className="sm:max-w-2xl"
        footer={<div className="flex justify-end"><Button variant="ghost" onClick={() => setOpen(null)}>Close</Button></div>}
      >
        {open?.answers && <ResponseView fields={(open.snapshot.fields ?? []) as FormField[]} answers={open.answers} />}
      </Dialog>
    </Card>
  );
}
