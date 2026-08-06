import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { TeamBoard } from "@/components/hub/team-board";
import { TeamExport } from "@/components/hub/team-export";
import { TEAM_ROLE_LABELS } from "@/lib/domain/enums";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function HubTeamPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const members = await provider.listTeam(membership.orgId);

  // Feedback #9 — the export table (matches the roster on screen).
  const now = clockNow();
  const day = (iso: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  const exportTable = {
    filenameBase: `team-${membership.orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${now.slice(0, 10)}`,
    title: "Team & roles",
    subtitle: `${membership.orgName} · ${day(now)} · ${members.length} member${members.length === 1 ? "" : "s"}`,
    headers: ["Name", "Email", "Role", "Supervisor", "Credential", "Credential status", "Caseload", "Status", "Joined"],
    rows: members.map((m) => [
      m.name, m.email, TEAM_ROLE_LABELS[m.teamRole], m.isSupervisor ? "Yes" : "",
      m.credential?.body ?? "", m.credential?.status ?? "", m.caseload != null ? String(m.caseload) : "",
      m.status, day(m.joinedAt),
    ]),
  };

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Team & roles"
        summary="Invite colleagues, set what each role can reach, and manage access  clinical notes stay with the counsellor and their supervisor."
        actions={<TeamExport table={exportTable} />}
      />
      <TeamBoard members={members} />
    </div>
  );
}
