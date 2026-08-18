import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/guard";
import { runForOrg } from "@/lib/db/scoped";
import { getDb } from "@/db/client";
import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { listTeamThreadsDb, clientHasThreadDb } from "@/db/queries/messages";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { TeamMessagesView } from "@/components/messages/team-messages-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

/**
 * Phase 34.1 - the client's conversation with their practice. Exists only once
 * the practice has messaged them (the nav item is gated the same way); the
 * client replies here but never starts a thread, never attaches, never sees
 * anyone else's conversations.
 */
export default async function ClientMessagesPage() {
  const { principal, clientId } = await requireClient();
  if (process.env.DATA_PROVIDER !== "db" || !(await clientHasThreadDb(clientId))) redirect("/me");

  const [row] = await getDb().select({ orgId: clients.orgId }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!row) redirect("/me");
  const threads = (await runForOrg(row.orgId, () => listTeamThreadsDb(principal.userId, row.orgId))).filter((t) => t.kind === "client");

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: row.orgId,
    target: `client:${clientId}`,
    reason: "client_messages_open",
  });

  return (
    <div className="rise space-y-5">
      <PageHead title="Messages" summary="Private messages between you and your care team." />
      <TeamMessagesView
        threads={threads}
        teammates={[]}
        realtime={null}
        myUserId={principal.userId}
        myName={principal.name}
        orgId={row.orgId}
        mode="client"
      />
    </div>
  );
}
