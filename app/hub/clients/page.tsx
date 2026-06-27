import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { HubClientsTable } from "@/components/hub/hub-clients-table";
import { AddClientButton } from "@/components/hub/add-client-modal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function HubClientsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = new Date().toISOString();
  const [rows, counsellors] = await Promise.all([
    provider.listOrgClients(membership.orgId, now),
    provider.listCounsellors(membership.orgId),
  ]);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/clients`,
    reason: "hub_oversight",
  });

  const counsellorOpts = counsellors.map((c) => ({ id: c.id, name: c.name }));
  const active = rows.filter((r) => r.status === "active").length;
  const safeguarding = rows.filter((r) => r.status === "at_risk").length;
  const newClients = rows.filter((r) => r.status === "new").length;
  const seenThisWeek = rows.filter((r) => r.lastSession && (new Date(now).getTime() - new Date(r.lastSession.startsAt).getTime()) < 7 * 864e5).length;

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Clients"
        summary={`${rows.length} across the practice. Reassign or remove without distorting your reporting.`}
        actions={<AddClientButton counsellors={counsellorOpts} />}
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat value={String(active)} label="Active" />
        <Stat value={String(newClients)} label="New · awaiting first session" />
        <Stat value={String(seenThisWeek)} label="Seen this week" />
        <Stat value={String(safeguarding)} label="Safeguarding" tone={safeguarding > 0 ? "danger" : "default"} />
      </div>

      <HubClientsTable rows={rows} counsellors={counsellorOpts} />
    </div>
  );
}

function Stat({ value, label, tone = "default" }: { value: string; label: string; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className={`text-[22px] font-bold tabular-nums ${tone === "danger" ? "text-danger" : "text-text"}`}>{value}</div>
      <div className="truncate text-[12px] text-text-2">{label}</div>
    </div>
  );
}
