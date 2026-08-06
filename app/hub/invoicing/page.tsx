import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { InvoiceBoard, type InvoiceRow } from "@/components/hub/invoice-board";
import { getOrgGatewayStatus } from "@/db/queries/org-gateway";
import { UninvoicedBanner } from "@/components/hub/uninvoiced-banner";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoicing" };

export default async function HubInvoicingPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const [invoices, clients, org, invoiceSettings, platform, gateway] = await Promise.all([
    provider.listOrgInvoices(membership.orgId),
    provider.listOrgClients(membership.orgId, now),
    provider.getOrg(membership.orgId),
    provider.getInvoiceSettings(membership.orgId),
    provider.getPlatformSettings(),
    getOrgGatewayStatus(membership.orgId),
  ]);
  const nameOf = new Map(clients.map((c) => [c.client.id, c.client.name]));

  // Completed sessions that never got billed — surfaced, never silent (batch 2).
  const uninvoiced = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/invoices")).listUninvoicedCompletedDb(membership.orgId)
    : [];
  const rows: InvoiceRow[] = invoices.map((invoice) => ({ invoice, clientName: nameOf.get(invoice.clientId) ?? "Client" }));

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/invoices`,
    reason: "hub_finance",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Invoicing"
        summary="Create, send, and track invoices. Payments settle to your own gateway once connected."
      />

      <UninvoicedBanner rows={uninvoiced} />
      <InvoiceBoard
        rows={rows}
        nowISO={now}
        orgName={org?.name ?? membership.orgName}
        province={org?.province ?? ""}
        vatRatePercent={platform.vatRatePercent}
        settings={invoiceSettings}
        paymentsEnabled={gateway.enabled && gateway.configured}
      />
    </div>
  );
}
