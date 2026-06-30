import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { TeamMessagesView } from "@/components/messages/team-messages-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const [threads, team] = await Promise.all([
    provider.listTeamThreads(principal.userId, membership.orgId),
    provider.listTeam(membership.orgId),
  ]);
  if (!team) notFound();

  const teammates = team
    .filter((m) => m.userId !== principal.userId && m.active)
    .map((m) => ({ userId: m.userId, name: m.name, role: m.teamRole }));

  return (
    <div className="rise space-y-5">
      <PageHead title="Messages" summary="Private messages with your team  the hub and your colleagues." />
      <TeamMessagesView threads={threads} teammates={teammates} />
    </div>
  );
}
