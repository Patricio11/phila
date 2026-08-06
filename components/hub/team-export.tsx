"use client";

import { ExportMenu } from "@/components/hub/export-menu";
import { auditTeamExport } from "@/app/hub/team/actions";
import type { ExportTable } from "@/lib/export/table-export";

/** Feedback #9 — Export on Team & roles. Audited as an admin action. */
export function TeamExport({ table }: { table: ExportTable }) {
  return <ExportMenu table={table} onExported={async (format) => { await auditTeamExport({ format, count: table.rows.length }); }} />;
}
