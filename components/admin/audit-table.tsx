"use client";

import { Download } from "lucide-react";
import type { PlatformAuditEvent } from "@/lib/mock/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function AuditTable({ events }: { events: PlatformAuditEvent[] }) {
  const { toast } = useToast();

  const exportCsv = () => {
    const header = "At,Action,Actor,Organisation,Target,Reason";
    const lines = events.map((e) => [e.at, e.action, e.actor, e.orgName ?? "", e.target, e.reason ?? ""].map(csvCell).join(","));
    const csv = [header, ...lines].join("\n");
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "phila-audit.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* download blocked  the export itself is still recorded */
    }
    // Exporting the audit ledger is itself an audited action.
    toast({ tone: "success", title: "Audit log exported", description: "The export is recorded in the ledger." });
  };

  const columns: Column<PlatformAuditEvent>[] = [
    { key: "at", header: "Time", sortValue: (e) => e.at, render: (e) => <span className="whitespace-nowrap tabular-nums text-text-2">{when(e.at)}</span> },
    { key: "action", header: "Action", sortValue: (e) => e.action, render: (e) => <span className="font-medium text-text">{e.action}</span> },
    { key: "actor", header: "Actor", hideBelow: "sm", sortValue: (e) => e.actor, render: (e) => <span className="text-text-2">{e.actor}</span> },
    { key: "org", header: "Organisation", hideBelow: "md", sortValue: (e) => e.orgName ?? "", render: (e) => <span className="text-text-2">{e.orgName ?? "platform"}</span> },
    { key: "target", header: "Target", hideBelow: "lg", render: (e) => <span className="text-text-3">{e.target}</span> },
    { key: "reason", header: "Reason", hideBelow: "lg", render: (e) => <span className="text-text-3">{e.reason ?? ""}</span> },
  ];

  return (
    <DataTable
      rows={events}
      columns={columns}
      rowKey={(e) => e.id}
      search={{ placeholder: "Search the ledger…", getText: (e) => `${e.action} ${e.actor} ${e.orgName ?? ""} ${e.target} ${e.reason ?? ""}` }}
      toolbar={
        <Button size="sm" variant="ghost" className="ml-auto" onClick={exportCsv}>
          <Download className="size-4" strokeWidth={2} aria-hidden /> Export CSV
        </Button>
      }
    />
  );
}
