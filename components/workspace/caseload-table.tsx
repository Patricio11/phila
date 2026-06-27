"use client";

import { useState } from "react";
import Link from "next/link";
import type { CaseloadRow, CaseloadStatus } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

const STATUS: Record<CaseloadStatus, { label: string; tone: DotTone }> = {
  new: { label: "New", tone: "blue" },
  active: { label: "Active", tone: "green" },
  at_risk: { label: "Safeguarding", tone: "rose" },
  inactive: { label: "Inactive", tone: "grey" },
};

const FILTERS: { key: "all" | CaseloadStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "at_risk", label: "Safeguarding" },
  { key: "new", label: "New" },
  { key: "inactive", label: "Inactive" },
];

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function CaseloadTable({ rows }: { rows: CaseloadRow[] }) {
  const [filter, setFilter] = useState<"all" | CaseloadStatus>("all");
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const columns: Column<CaseloadRow>[] = [
    {
      key: "name",
      header: "Client",
      sortValue: (r) => r.client.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.client.name} size="sm" />
          <Link
            href={`/app/clients/${r.client.id}`}
            className="font-medium text-text hover:text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.client.name}
          </Link>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => {
        const s = STATUS[r.status];
        return (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2">
            <StatusDot tone={s.tone} /> {s.label}
          </span>
        );
      },
    },
    {
      key: "next",
      header: "Next session",
      hideBelow: "sm",
      sortValue: (r) => r.nextSession?.startsAt ?? "9999",
      render: (r) =>
        r.nextSession ? (
          <span className="text-text-2">{shortDate(r.nextSession.startsAt)}</span>
        ) : (
          <span className="text-text-3"></span>
        ),
    },
    {
      key: "last",
      header: "Last seen",
      hideBelow: "md",
      sortValue: (r) => r.lastSession?.startsAt ?? "0",
      render: (r) => <span className="text-text-2">{shortDate(r.lastSession?.startsAt)}</span>,
    },
    {
      key: "count",
      header: "Sessions",
      align: "right",
      hideBelow: "lg",
      sortValue: (r) => r.sessionCount,
      render: (r) => <span className="text-text-2 tabular-nums">{r.sessionCount}</span>,
    },
    {
      key: "province",
      header: "Province",
      hideBelow: "lg",
      sortValue: (r) => r.client.province,
      render: (r) => <span className="text-text-3">{r.client.province}</span>,
    },
  ];

  return (
    <DataTable
      rows={shown}
      columns={columns}
      rowKey={(r) => r.client.id}
      rowHref={(r) => `/app/clients/${r.client.id}`}
      search={{ placeholder: "Search clients…", getText: (r) => `${r.client.name} ${r.client.province}` }}
      toolbar={
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-9 rounded-control px-3 text-[12.5px] font-medium transition-colors",
                filter === f.key
                  ? "bg-accent-soft text-accent"
                  : "text-text-2 hover:bg-surface-hover hover:text-text",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
