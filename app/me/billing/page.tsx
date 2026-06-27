import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceList } from "@/components/client/invoice-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function MeBillingPage() {
  const { principal, clientId } = await requireClient();
  const provider = await getDataProvider();

  const client = await provider.getClient(clientId);
  if (!client) notFound();
  const [org, invoices] = await Promise.all([
    provider.getOrg(client.orgId),
    provider.listClientInvoices(clientId),
  ]);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: client.orgId,
    target: `client:${clientId}/invoices`,
    reason: "own_record",
  });

  return (
    <div className="rise space-y-6">
      <PageHead title="Billing" summary="Your invoices from the practice." />
      {invoices.length > 0 ? (
        <InvoiceList invoices={invoices} payEnabled={Boolean(org?.features.payments)} />
      ) : (
        <Card className="p-2">
          <EmptyState icon={Receipt} title="No invoices yet" body="Invoices from your practice will appear here." />
        </Card>
      )}
    </div>
  );
}
