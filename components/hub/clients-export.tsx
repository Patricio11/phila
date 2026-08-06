"use client";

import { ExportMenu } from "@/components/hub/export-menu";
import { auditClientsExport } from "@/app/hub/clients/actions";
import type { ExportTable } from "@/lib/export/table-export";

/** Feedback #9 - Export on Clients. Every export is audited as pii.export. */
export function ClientsExport({ table }: { table: ExportTable }) {
  return <ExportMenu table={table} onExported={async (format) => { await auditClientsExport({ format, count: table.rows.length }); }} />;
}
