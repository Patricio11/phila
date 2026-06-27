"use client";

import { useState } from "react";
import { Send, Users } from "lucide-react";
import type { IntakeStatusRow } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type IntakeState = IntakeStatusRow["status"];

const STATUS: Record<IntakeState, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-accent-soft text-accent" },
  sent: { label: "Sent · awaiting", cls: "bg-warn-soft text-warn" },
  not_sent: { label: "Not sent", cls: "bg-surface-2 text-text-3" },
};

export function IntakeTracker({ rows }: { rows: IntakeStatusRow[] }) {
  const { toast } = useToast();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const statusOf = (r: IntakeStatusRow): IntakeState => (r.status === "not_sent" && sent.has(r.client.id) ? "sent" : r.status);

  const send = (r: IntakeStatusRow) => {
    const already = statusOf(r) === "sent";
    setSent((prev) => new Set(prev).add(r.client.id));
    toast({ tone: "success", title: `Intake ${already ? "re-sent" : "sent"} to ${r.client.name.split(" ")[0]}`, description: "They'll get a link by WhatsApp and email once messaging is set up." });
  };

  const view = rows.map((r) => ({ ...r, _status: statusOf(r) }));
  const completed = view.filter((r) => r._status === "completed").length;
  const awaiting = view.filter((r) => r._status === "sent").length;
  const notSent = view.filter((r) => r._status === "not_sent").length;

  const columns: Column<IntakeStatusRow>[] = [
    {
      key: "name",
      header: "Client",
      sortValue: (r) => r.client.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.client.name} size="sm" />
          <span className="font-medium text-text">{r.client.name}</span>
        </div>
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
          <span className="text-[12px] text-text-3"></span>
        ) : (
          <Button variant="mini" onClick={() => send(r)}>
            <Send className="size-3.5" strokeWidth={2} aria-hidden /> {statusOf(r) === "sent" ? "Resend" : "Send"}
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3.5 sm:max-w-lg">
        <Stat value={String(completed)} label="Completed" tone="accent" />
        <Stat value={String(awaiting)} label="Awaiting" tone="warn" />
        <Stat value={String(notSent)} label="Not sent" tone="muted" />
      </div>

      <DataTable
        rows={view}
        columns={columns}
        rowKey={(r) => r.client.id}
        search={{ placeholder: "Search clients…", getText: (r) => `${r.client.name} ${r.counsellorName}` }}
        toolbar={
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => toast({ tone: "default", title: "Send to a programme cohort", description: "Pick a cohort to send the intake to everyone at once." })}
          >
            <Users className="size-4" strokeWidth={2} aria-hidden /> Send to cohort
          </Button>
        }
      />
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
