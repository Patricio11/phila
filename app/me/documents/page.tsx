import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { DocumentList } from "@/components/client/document-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function MeDocumentsPage() {
  const { principal, clientId } = await requireClient();
  const provider = await getDataProvider();

  const client = await provider.getClient(clientId);
  if (!client) notFound();
  const documents = await provider.listClientDocuments(clientId);

  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: client.orgId,
    target: `client:${clientId}/documents`,
    reason: "own_record",
  });

  return (
    <div className="rise space-y-6">
      <PageHead title="Documents" summary="Reports and resources shared with you — and anything you upload." />
      <DocumentList documents={documents} />
    </div>
  );
}
