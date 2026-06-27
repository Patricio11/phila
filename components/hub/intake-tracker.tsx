"use client";

import { Send, Users } from "lucide-react";
import type { IntakeStatusRow } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const STATUS: Record<IntakeStatusRow["status"], { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-accent-soft text-accent" },
  sent: { label: "Sent · awaiting", cls: "bg-warn-soft text-warn" },
  not_sent: { label: "Not sent", cls: "bg-surface-2 text-text-3" },
};

export function IntakeTracker({ rows }: { rows: IntakeStatusRow[] }) {
  const { toast } = useToast();

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
    {
      key: "counsellor",
      header: "Counsellor",
      hideBelow: "md",
      sortValue: (r) => r.counsellorName,
      render: (r) => <span className="text-text-2">{r.counsellorName}</span>,
    },
    {
      key: "status",
      header: "Intake",
      sortValue: (r) => r.status,
      render: (r) => (
        <span className={cn("inline-flex rounded-chip px-2 py-0.5 text-[11.5px] font-semibold", STATUS[r.status].cls)}>
          {STATUS[r.status].label}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        r.status === "completed" ? (
          <span className="text-[12px] text-text-3">—</span>
        ) : (
          <Button
            variant="mini"
            onClick={() => toast({ tone: "success", title: `Intake ${r.status === "sent" ? "re-sent" : "sent"} to ${r.client.name.split(" ")[0]}`, description: "They'll get a link by WhatsApp and email once messaging is set up." })}
          >
            <Send className="size-3.5" strokeWidth={2} aria-hidden /> {r.status === "sent" ? "Resend" : "Send"}
          </Button>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
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
  );
}
