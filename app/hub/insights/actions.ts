"use server";

import { z } from "zod";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import type { HubInsights } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";

const input = z.object({
  period: z.enum(["week", "month", "quarter"]).optional(),
  province: z.string().optional(),
  gender: z.string().optional(),
  ageBand: z.string().optional(),
});

/** Recompute Hub insights for a filter set. Audited  demographic cuts are PII. */
export async function runInsights(raw: z.infer<typeof input>): Promise<HubInsights> {
  const { principal, membership } = await requireHub();
  const filters = input.parse(raw);
  const provider = await getDataProvider();

  await logAccess({
    action: "demographics.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/insights`,
    reason: "filter_insights",
  });

  return provider.getHubInsights(membership.orgId, clockNow(), filters);
}

/* ---- Operational reports (batch 2c) — Picktime-style, exportable ---- */

/** Preset period → SAST range. */
function reportRange(period: string, nowISO: string): { from: string; to: string } {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const now = new Date(nowISO);
  const today = day(now);
  const at = (date: string) => new Date(`${date}T00:00:00+02:00`);
  const shift = (date: string, days: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const dow = at(today).getUTCDay() === 0 ? 7 : new Date(`${today}T12:00:00Z`).getUTCDay(); // 1..7 Mon..Sun
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  switch (period) {
    case "today": return { from: at(today).toISOString(), to: at(shift(today, 1)).toISOString() };
    case "week": { const mon = shift(today, -(dow - 1)); return { from: at(mon).toISOString(), to: at(shift(mon, 7)).toISOString() }; }
    case "last_month": { const first = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`; return { from: at(first).toISOString(), to: at(`${y}-${String(m).padStart(2, "0")}-01`).toISOString() }; }
    case "quarter": { const qm = m - ((m - 1) % 3); return { from: at(`${y}-${String(qm).padStart(2, "0")}-01`).toISOString(), to: at(shift(today, 1)).toISOString() }; }
    case "ytd": return { from: at(`${y}-01-01`).toISOString(), to: at(shift(today, 1)).toISOString() };
    default: return { from: at(`${y}-${String(m).padStart(2, "0")}-01`).toISOString(), to: at(shift(today, 1)).toISOString() }; // this month
  }
}

export async function getOperationalReport(
  raw: { type: string; period: string },
): Promise<{ ok: true; report: import("@/db/queries/reports").OperationalReport } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const { REPORT_TYPES, operationalReportDb } = await import("@/db/queries/reports");
  const type = (REPORT_TYPES as readonly string[]).includes(raw?.type) ? raw.type as import("@/db/queries/reports").ReportType : "bookings";
  if (process.env.DATA_PROVIDER !== "db") return { ok: false, error: "Not available in demo mode." };

  const { now: clockNow } = await import("@/lib/clock");
  const { from, to } = reportRange(raw?.period ?? "month", clockNow());
  const report = await operationalReportDb(membership.orgId, type, from, to);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/report/${type}`,
    reason: `report_view_${type}`,
  });
  return { ok: true, report };
}

/** Exports of operational reports carry client PII — always audited (fail-strict class). */
export async function auditReportExport(
  raw: { type: string; format: string; count: number },
): Promise<{ ok: true }> {
  const { principal, membership } = await requireHub();
  await logAccess({
    action: "pii.export",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/report/${raw?.type}.${raw?.format}`,
    reason: `report_export_${raw?.type}_${raw?.format}:${Math.max(0, Math.floor(raw?.count ?? 0))}`,
  });
  return { ok: true };
}
