import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { TeamTable } from "@/components/hub/team-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function HubTeamPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const members = await provider.listTeam(membership.orgId);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Team & roles"
        summary="Each member's role sets exactly what they can reach — clinical notes stay with the counsellor and their supervisor."
      />
      <TeamTable members={members} />
    </div>
  );
}
