import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { CounsellorDocuments } from "@/components/workspace/counsellor-documents";
import { CounsellorRequests } from "@/components/workspace/counsellor-requests";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function CounsellorDocumentsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const me = (await provider.listCounsellors(membership.orgId)).find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const [{ own, shared, sharedNotes, sharedFolders }, clients, requests] = await Promise.all([
    provider.listCounsellorDocuments(me.id),
    provider.listClients(membership.orgId),
    // Batch 2z - what the practice has asked this counsellor to upload.
    process.env.DATA_PROVIDER === "db"
      ? (await import("@/db/queries/documents")).listCounsellorRequestsDb(me.id)
      : Promise.resolve([]),
  ]);

  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `counsellor:${me.id}/documents`,
    reason: "own_documents",
  });

  return (
    <div className="rise space-y-6">
      <PageHead title="Documents" summary="Your clients' files, plus anything the practice has shared with you." />
      <CounsellorRequests requests={requests} />
      <CounsellorDocuments sharedNotes={sharedNotes} own={own} shared={shared} sharedFolders={sharedFolders} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
