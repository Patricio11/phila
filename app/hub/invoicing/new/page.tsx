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

  const [org, clients, services] = await Promise.all([
    provider.getOrg(membership.orgId),
    provider.listOrgClients(membership.orgId, now),
    provider.listServices(membership.orgId),
  ]);
  if (!org) notFound();

  return (
    <InvoiceBuilder
      orgName={org.name}
      province={org.province}
      clients={clients.map((c) => ({ id: c.client.id, name: c.client.name }))}
      services={services.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents }))}
      invoiceNumber="MZ-2026-0148"
      backHref="/hub/invoicing"
    />
  );
}
