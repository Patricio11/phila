import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { getStorageStatus } from "@/lib/storage";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { ClientDocuments } from "@/components/client/client-documents";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function MeDocumentsPage() {
  const { principal, clientId } = await requireClient();
  const provider = await getDataProvider();

  const client = await provider.getClient(clientId);
  if (!client) notFound();

  const [documents, requests, storage] = await Promise.all([
    provider.listClientVisibleDocuments(clientId),
    provider.listClientDocumentRequests(clientId),
    getStorageStatus(),
  ]);

  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: client.orgId,
    target: `client:${clientId}/documents`,
    reason: "own_record",
  });

  return (
    <div className="rise space-y-6">
      <PageHead title="Documents" summary="Reports and resources shared with you  and anything your counsellor asks you to upload." />
      <ClientDocuments documents={documents} requests={requests} storageEnabled={storage.enabled} />
    </div>
  );
}
