import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { getStorageStatus } from "@/lib/storage";
import { PageHead } from "@/components/shell/page-head";
import { DocumentManager } from "@/components/documents/document-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function HubDocumentsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();

  const [folders, documents, clients, counsellors, requests, usage, storage] = await Promise.all([
    provider.listOrgFolders(membership.orgId),
    provider.listOrgDocuments(membership.orgId),
    provider.listClients(membership.orgId),
    provider.listCounsellors(membership.orgId),
    provider.listDocumentRequests(membership.orgId),
    provider.getStorageUsage(membership.orgId),
    getStorageStatus(),
  ]);

  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/documents`,
    reason: "manage_documents",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Documents"
        summary="Your practice's files, organised in folders. Move, assign to a client, share with a counsellor — everything in one calm place."
      />
      <DocumentManager
        folders={folders}
        documents={documents}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        counsellors={counsellors.map((c) => ({ id: c.id, name: c.name }))}
        requests={requests}
        usage={usage}
        storageEnabled={storage.enabled}
      />
    </div>
  );
}
