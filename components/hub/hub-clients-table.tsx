"use client";

import { useState } from "react";
import { ArrowLeftRight, UserMinus } from "lucide-react";
import type { CaseloadStatus, OrgClientRow } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";

const STATUS: Record<CaseloadStatus, { label: string; tone: DotTone }> = {
  new: { label: "New", tone: "blue" },
  active: { label: "Active", tone: "green" },
  at_risk: { label: "Safeguarding", tone: "rose" },
  inactive: { label: "Inactive", tone: "grey" },
};

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
}

export function HubClientsTable({ rows }: { rows: OrgClientRow[] }) {
  const { toast } = useToast();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const shown = rows.filter((r) => !removed.has(r.client.id));

  const columns: Column<OrgClientRow>[] = [
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
      sortValue: (r) => r.counsellorName,
      render: (r) => <span className="text-text-2">{r.counsellorName}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2">
          <StatusDot tone={STATUS[r.status].tone} /> {STATUS[r.status].label}
        </span>
      ),
    },
    {
      key: "next",
      header: "Next",
      hideBelow: "md",
      sortValue: (r) => r.nextSession?.startsAt ?? "9999",
      render: (r) => <span className="text-text-2">{shortDate(r.nextSession?.startsAt)}</span>,
    },
    {
      key: "last",
      header: "Last seen",
      hideBelow: "lg",
      sortValue: (r) => r.lastSession?.startsAt ?? "0",
      render: (r) => <span className="text-text-2">{shortDate(r.lastSession?.startsAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="mini"
            onClick={() => toast({ tone: "default", title: `Reassign ${r.client.name.split(" ")[0]}`, description: "Move to another counsellor." })}
          >
            <ArrowLeftRight className="size-3.5" strokeWidth={2} aria-hidden /> Reassign
          </Button>
          <Button
            variant="mini"
            onClick={() => {
              setRemoved((prev) => new Set(prev).add(r.client.id));
              toast({ tone: "default", title: `${r.client.name.split(" ")[0]} removed from the active list`, description: "Their stats are preserved — reporting stays accurate." });
            }}
          >
            <UserMinus className="size-3.5" strokeWidth={2} aria-hidden /> Cancel
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      rows={shown}
      columns={columns}
      rowKey={(r) => r.client.id}
      search={{ placeholder: "Search clients…", getText: (r) => `${r.client.name} ${r.counsellorName} ${r.client.province}` }}
    />
  );
}
