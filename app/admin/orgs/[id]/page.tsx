import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider, type TeamMemberView } from "@/lib/data-provider";
import type { TeamRole } from "@/lib/domain/enums";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { OrgDocReview } from "@/components/admin/org-doc-review";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { CredentialChip } from "@/components/ui/credential-chip";
import { TeamRoleChip, ROLE_REACH } from "@/components/hub/team-role-chip";

export const dynamic = "force-dynamic";

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

const GROUPS: { title: string; roles: TeamRole[] }[] = [
  { title: "Administrators", roles: ["org_admin"] },
  { title: "Counsellors", roles: ["counsellor"] },
  { title: "Operations", roles: ["front_desk", "finance", "programme_manager"] },
];

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requireSuperAdmin();
  const provider = await getDataProvider();
  const [detail, review] = await Promise.all([
    provider.getPlatformOrgDetail(id),
    provider.getOrgOnboardingReview(id),
  ]);
  if (!detail) notFound();

  const VERIFY: Record<typeof review.verification, { label: string; tone: "accent" | "warn" | "danger" }> = {
    verified: { label: "Verified", tone: "accent" },
    pending: { label: "Verification pending", tone: "warn" },
    action_needed: { label: "Action needed", tone: "danger" },
  };
  const vstate = VERIFY[review.verification];

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: id,
    target: `org:${id}`,
    reason: "view_org_detail",
  });

  const { org, team, clientCount } = detail;

  return (
    <div className="rise space-y-6">
      <Link href="/admin/orgs" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All organisations
      </Link>

      <PageHead
        title={
          <span className="flex items-center gap-2.5">
            <Avatar name={org.name} size="md" /> {org.name}
          </span>
        }
        summary={`${org.province} · ${detail.planName} plan`}
        actions={
          <div className="flex items-center gap-2">
            <Tag tone={vstate.tone}>{vstate.label}</Tag>
            <Tag tone={org.suspended ? "neutral" : org.subscriptionStatus === "active" ? "accent" : org.subscriptionStatus === "trialing" ? "info" : "warn"}>{org.suspended ? "Suspended" : org.subscriptionStatus}</Tag>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Stat value={detail.planName} label={`${rands(detail.planPriceCents)}/mo`} />
        <Stat value={String(org.members)} label="Team members" />
        <Stat value={detail.fullyModeled ? String(clientCount) : ""} label="Clients" />
        <Stat value={String(org.sessions7d)} label="Sessions · 7d" />
        <Stat value={rands(org.aiSpendCents)} label="AI spend" />
      </div>

      {/* Verification documents */}
      <Card>
        <CardHead title="Verification documents" action={<Tag tone={vstate.tone}>{vstate.label}</Tag>} />
        <div className="px-[17px] pb-[17px]">
          <p className="mb-3 text-[12.5px] text-text-2">What this practice uploaded during onboarding. Verify each, or send one back. Verification gates payouts and funder sharing.</p>
          <OrgDocReview orgId={id} docs={review.docs} />
        </div>
      </Card>

      {detail.fullyModeled ? (
        GROUPS.map((g) => {
          const members = team.filter((m) => g.roles.includes(m.teamRole));
          if (members.length === 0) return null;
          return (
            <Card key={g.title}>
              <CardHead title={g.title} count={members.length} />
              <div className="grid gap-2 px-[17px] pb-[17px] sm:grid-cols-2">
                {members.map((m) => <Member key={m.userId} m={m} />)}
              </div>
            </Card>
          );
        })
      ) : (
        <Card className="p-2">
          <div className="flex items-start gap-2.5 p-4 text-[13px] text-text-2">
            <Info className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
            <div>
              <div className="font-medium text-text">{org.members} members · {org.name}</div>
              <p className="mt-1 text-[12.5px]">The full member and client directory loads when you impersonate this org (an audited action). Platform-level figures above are always available.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Member({ m }: { m: TeamMemberView }) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-border p-3">
      <Avatar name={m.name} size="md" verified={m.credential?.status === "verified"} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-text">{m.name}{!m.active && <span className="ml-1.5 text-[11px] text-text-3">· deactivated</span>}</div>
        <div className="truncate text-[11.5px] text-text-3">{m.email}</div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <TeamRoleChip role={m.teamRole} />
          {m.isSupervisor && <span className="text-[10.5px] text-accent">+ supervisor</span>}
          {m.credential && <CredentialChip body={m.credential.body} status={m.credential.status} />}
        </div>
        <div className="mt-1 text-[10.5px] text-text-3">{ROLE_REACH[m.teamRole]}</div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="truncate text-[18px] font-bold text-text">{value}</div>
      <div className="text-[12px] text-text-2">{label}</div>
    </div>
  );
}
