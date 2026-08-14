import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { InvoiceBuilder } from "@/components/documents/invoice-builder";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "New invoice", robots: { index: false } };

export default async function NewInvoicePage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();

  const [org, clients, services, invoiceSettings, platform, invoices] = await Promise.all([
    provider.getOrg(membership.orgId),
    provider.listOrgClients(membership.orgId, now),
    provider.listServices(membership.orgId),
    provider.getInvoiceSettings(membership.orgId),
    provider.getPlatformSettings(),
    provider.listOrgInvoices(membership.orgId),
  ]);
  if (!org) notFound();

  // Next number in the org's series: PREFIX-YEAR-NNNN.
  const year = now.slice(0, 4);
  const invoiceNumber = `${invoiceSettings.invoicePrefix}-${year}-${String(invoices.length + 1).padStart(4, "0")}`;

  // Batch 3l - the sessions this invoice can bill (unbilled, last 180 days + upcoming).
  const linkableSessions = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/invoices")).listLinkableSessionsDb(membership.orgId)
    : [];

  return (
    <InvoiceBuilder
      linkableSessions={linkableSessions}
      orgName={org.name}
      province={org.province}
      clients={clients.map((c) => ({ id: c.client.id, name: c.client.name }))}
      services={services.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents }))}
      invoiceNumber={invoiceNumber}
      backHref="/hub/invoicing"
      vatRatePercent={platform.vatRatePercent}
      settings={invoiceSettings}
      paymentsEnabled={Boolean(org.features.payments)}
    />
  );
}
