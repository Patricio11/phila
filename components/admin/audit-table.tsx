"use client";

import type { PlatformAuditEvent } from "@/lib/domain/types";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ExportMenu } from "@/components/hub/export-menu";
import { auditLedgerExport } from "@/app/admin/audit/actions";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function AuditTable({ events }: { events: PlatformAuditEvent[] }) {
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
        <div className="ml-auto">
          {/* The house export (CSV / Excel / PDF) - and exporting the ledger is itself audited. */}
          <ExportMenu
            table={{
              filenameBase: "phila-audit",
              title: "Platform audit ledger",
              subtitle: `${events.length} events`,
              headers: ["At", "Action", "Actor", "Organisation", "Target", "Reason"],
              rows: events.map((e) => [e.at, e.action, e.actor, e.orgName ?? "platform", e.target, e.reason ?? ""]),
            }}
            onExported={async (format) => { await auditLedgerExport({ format, count: events.length }); }}
          />
        </div>
      }
    />
  );
}
