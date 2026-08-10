import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHead } from "@/components/shell/page-head";
import { HubClientsTable } from "@/components/hub/hub-clients-table";
import { AddClientButton } from "@/components/hub/add-client-modal";
import { ImportClientsButton } from "@/components/hub/import-clients-modal";
import { DedupeBanner } from "@/components/hub/dedupe-clients";
import { ClientsExport } from "@/components/hub/clients-export";
import { phoneKey, emailKey } from "@/lib/import/validate";
import { now as clockNow } from "@/lib/clock";
import { languageName } from "@/lib/domain/languages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function HubClientsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();
  const [rows, removedRows, counsellors, duplicates, org] = await Promise.all([
    provider.listOrgClients(membership.orgId, now),
    provider.listRemovedClients(membership.orgId, now),
    provider.listCounsellors(membership.orgId),
    provider.findDuplicateClients(membership.orgId, now),
    provider.getOrg(membership.orgId),
  ]);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/clients`,
    reason: "hub_oversight",
  });

  const counsellorOpts = counsellors.map((c) => ({ id: c.id, name: c.name }));

  // Batch 2p - companies ARE clients (an employer paying for its staff), so they
  // live behind a button here rather than a separate place in the sidebar.
  const companyCount = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/companies")).countCompaniesDb(membership.orgId)
    : 0;

  // Phase 32.0 behind the feature switch: off = no Language column or filter.
  const languageOn = process.env.DATA_PROVIDER === "db"
    ? (await (await import("@/db/queries/features")).effectiveFeaturesDb(membership.orgId)).language
    : Boolean(org?.features.language);

  // Feedback #9 - the export table (built here so the file matches the live list).
  const day = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "";
  const exportTable = {
    filenameBase: `clients-${membership.orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${now.slice(0, 10)}`,
    title: "Clients",
    subtitle: `${membership.orgName} · ${day(now)} · ${rows.length} client${rows.length === 1 ? "" : "s"}`,
    headers: ["Name", "Phone", "Email", "Province", ...(languageOn ? ["Language"] : []), "Counsellor", "Status", "Safeguarding", "Next session", "Last session", "Client since"],
    rows: rows.map((r) => [
      r.client.name, r.client.phone ?? "", r.client.email ?? "", r.client.province,
      ...(languageOn ? [languageName(r.client.homeLanguage)] : []),
      r.counsellorName, r.status, r.client.riskFlag ? "Flagged" : "",
      day(r.nextSession?.startsAt), day(r.lastSession?.startsAt), day(r.client.createdAt),
    ]),
  };
  // Dedupe keys of existing clients (live + removed) so the import skips repeats.
  const existingKeys = [...rows, ...removedRows]
    .flatMap((r) => [phoneKey(r.client.phone), emailKey(r.client.email)])
    .filter((k): k is string => Boolean(k));

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Clients"
        summary={`${rows.length} across the practice. Filter by status or counsellor, reassign, or remove and restore  reporting stays accurate.`}
        actions={
          <div className="flex items-center gap-2">
            <ClientsExport table={exportTable} />
            <ImportClientsButton existingKeys={existingKeys} />
            <AddClientButton counsellors={counsellorOpts} inviteOnCreateDefault={Boolean(org?.clientPortal.inviteOnCreate)} referralsOn={Boolean(org?.features.referrals)} />
          </div>
        }
      />

      <DedupeBanner groups={duplicates} />

      <HubClientsTable
        rows={rows}
        removedRows={removedRows}
        counsellors={counsellorOpts}
        languageOn={languageOn}
        rightSlot={
          // Companies are clients too - the employer paying for its staff. Same
          // row as the status filters, held to the right so it reads as a
          // sibling view rather than another filter.
          <Link
            href="/hub/companies"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Building2 className="size-3.5" strokeWidth={2} aria-hidden />
            Companies
            {companyCount > 0 && <span className="tabular-nums text-text-3">{companyCount}</span>}
          </Link>
        }
      />
    </div>
  );
}
