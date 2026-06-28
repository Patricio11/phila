"use client";

import { useState } from "react";
import { Eye, FileText, Send, Users } from "lucide-react";
import type { IntakeBoard, IntakeReviewRow } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { IntakeDetail } from "@/components/hub/intake-detail";
import { cn } from "@/lib/utils";

type IntakeState = IntakeReviewRow["status"];

const STATUS: Record<IntakeState, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-accent-soft text-accent" },
  sent: { label: "Sent · awaiting", cls: "bg-warn-soft text-warn" },
  not_sent: { label: "Not sent", cls: "bg-surface-2 text-text-3" },
};

export function IntakeTracker({ board }: { board: IntakeBoard }) {
  const { toast } = useToast();
  const { form } = board;
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<IntakeReviewRow | null>(null);
  const [previewForm, setPreviewForm] = useState(false);

  const statusOf = (r: IntakeReviewRow): IntakeState => (r.status === "not_sent" && sent.has(r.client.id) ? "sent" : r.status);

  const send = (r: IntakeReviewRow) => {
    const already = statusOf(r) === "sent";
    setSent((prev) => new Set(prev).add(r.client.id));
    toast({ tone: "success", title: `Intake ${already ? "re-sent" : "sent"} to ${r.client.name.split(" ")[0]}`, description: "They'll get a link by WhatsApp and email once messaging is set up." });
  };

  const rows = board.rows;
  const completed = rows.filter((r) => statusOf(r) === "completed").length;
  const awaiting = rows.filter((r) => statusOf(r) === "sent").length;
  const notSent = rows.filter((r) => statusOf(r) === "not_sent").length;

  const columns: Column<IntakeReviewRow>[] = [
    {
      key: "name",
      header: "Client",
      sortValue: (r) => r.client.name,
      render: (r) => (
        <button type="button" onClick={() => setOpen(r)} className="group flex items-center gap-2.5 text-left">
          <Avatar name={r.client.name} size="sm" />
          <span className="font-medium text-text group-hover:text-accent group-hover:underline">{r.client.name}</span>
        </button>
      ),
    },
    { key: "counsellor", header: "Counsellor", hideBelow: "md", sortValue: (r) => r.counsellorName, render: (r) => <span className="text-text-2">{r.counsellorName}</span> },
    {
      key: "status",
      header: "Intake",
      sortValue: (r) => statusOf(r),
      render: (r) => <span className={cn("inline-flex rounded-chip px-2 py-0.5 text-[11.5px] font-semibold", STATUS[statusOf(r)].cls)}>{STATUS[statusOf(r)].label}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        statusOf(r) === "completed" ? (
          <Button variant="mini" onClick={() => setOpen(r)}><Eye className="size-3.5" strokeWidth={2} aria-hidden /> View answers</Button>
        ) : (
          <Button variant="mini" onClick={() => send(r)}>
            <Send className="size-3.5" strokeWidth={2} aria-hidden /> {statusOf(r) === "sent" ? "Resend" : "Send"}
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* What intake is */}
      <div className="flex items-start gap-2.5 rounded-control border border-border bg-surface-2/40 p-3.5">
        <FileText className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-text-2">
          The <span className="font-medium text-text">intake form</span> is the few questions a client answers before their first session — contact details and what they&apos;d like support with — so their counsellor can prepare. Send it to a client, and their answers appear here once submitted.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3.5 sm:max-w-lg">
        <Stat value={String(completed)} label="Completed" tone="accent" />
        <Stat value={String(awaiting)} label="Awaiting" tone="warn" />
        <Stat value={String(notSent)} label="Not sent" tone="muted" />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.client.id}
        search={{ placeholder: "Search clients…", getText: (r) => `${r.client.name} ${r.counsellorName}` }}
        toolbar={
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreviewForm(true)}>
              <Eye className="size-4" strokeWidth={2} aria-hidden /> Preview form
            </Button>
            <Button size="sm" onClick={() => toast({ tone: "default", title: "Send to a programme cohort", description: "Pick a cohort to send the intake to everyone at once." })}>
              <Users className="size-4" strokeWidth={2} aria-hidden /> Send to cohort
            </Button>
          </div>
        }
      />

      {/* Per-client detail */}
      <IntakeDetail
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        form={form}
        clientName={open?.client.name}
        status={open ? statusOf(open) : undefined}
        submittedAt={open?.submittedAt}
        answers={open?.answers}
        onSend={open ? () => { send(open); setOpen(null); } : undefined}
      />

      {/* Blank form preview */}
      <IntakeDetail open={previewForm} onClose={() => setPreviewForm(false)} form={form} />
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: "accent" | "warn" | "muted" }) {
  const cls = tone === "accent" ? "text-accent" : tone === "warn" ? "text-warn" : "text-text-3";
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className={cn("text-[22px] font-bold tabular-nums", cls)}>{value}</div>
      <div className="text-[12px] text-text-2">{label}</div>
    </div>
  );
}
