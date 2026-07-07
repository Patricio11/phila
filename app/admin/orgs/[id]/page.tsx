import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getCreditBalances } from "@/db/queries/messaging";
import { GrantCredits } from "@/components/admin/grant-credits";
import { getDataProvider, type TeamMemberView } from "@/lib/data-provider";
import type { TeamRole } from "@/lib/domain/enums";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { OrgDocReview } from "@/components/admin/org-doc-review";
import { OrgVerificationActions } from "@/components/admin/org-verification-actions";
import { OrgFeaturePanel } from "@/components/admin/org-feature-panel";
import { resolveAllFeaturesDb } from "@/db/queries/features";
import { ORG_FEATURES } from "@/lib/domain/enums";
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

/** Company-profile fields shown on the admin review (label per stored key). */
const COMPANY_FIELDS: [string, string][] = [
  ["registrationNo", "Registration no."],
  ["vatNo", "VAT number"],
  ["taxNo", "Income tax no."],
  ["practiceNo", "HPCSA practice no."],
  ["infoOfficerName", "Information Officer"],
  ["infoOfficerEmail", "Officer email"],
  ["phone", "Phone"],
  ["website", "Website"],
  ["physicalAddress", "Physical address"],
  ["postalAddress", "Postal address"],
];

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requireSuperAdmin();
  const provider = await getDataProvider();
  const [detail, review, credits, featureMap] = await Promise.all([
    provider.getPlatformOrgDetail(id),
    provider.getOrgOnboardingReview(id),
    getCreditBalances(id),
    process.env.DATA_PROVIDER === "db" ? resolveAllFeaturesDb(id) : Promise.resolve(null),
  ]);
  if (!detail) notFound();
  const featureResolutions = featureMap ? ORG_FEATURES.map((f) => featureMap[f]) : [];

  // The org's lifecycle stage (coherent with the orgs list), not the per-doc roll-up.
  const STAGE: Record<string, { label: string; tone: "accent" | "warn" | "danger" | "info" | "neutral" }> = {
    verified: { label: "Verified", tone: "accent" },
    submitted: { label: "Submitted for review", tone: "info" },
    action_needed: { label: "Action needed", tone: "danger" },
    not_started: { label: "Onboarding", tone: "neutral" },
  };
  const vstate = STAGE[detail.onboardingStatus ?? "not_started"] ?? STAGE.not_started!;

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

      {/* Company information the practice submitted */}
      {detail.profile && Object.values(detail.profile).some(Boolean) && (
        <Card>
          <CardHead title="Company information" />
          <div className="grid gap-x-6 gap-y-3 px-[17px] pb-[17px] sm:grid-cols-2">
            {COMPANY_FIELDS.map(([key, label]) => {
              const val = detail.profile?.[key];
              if (!val) return null;
              return (
                <div key={key} className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-text-3">{label}</div>
                  <div className="truncate text-[13px] text-text">{val}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Verification decision + documents */}
      <Card>
        <CardHead title="Verification documents" action={<Tag tone={vstate.tone}>{vstate.label}</Tag>} />
        <div className="space-y-4 px-[17px] pb-[17px]">
          <p className="text-[12.5px] text-text-2">What this practice uploaded during onboarding. Verify each, or send one back. Verification gates payouts and funder sharing.</p>
          <OrgDocReview orgId={id} docs={review.docs} />
          <div className="border-t border-border pt-4">
            <OrgVerificationActions orgId={id} status={detail.onboardingStatus ?? "not_started"} />
          </div>
        </div>
      </Card>

      {/* Feature entitlements — effective state + per-org override (W3.3) */}
      {featureResolutions.length > 0 && (
        <Card>
          <CardHead title="Features" action={<span className="text-[11.5px] text-text-3">{detail.planName} plan</span>} />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-1 text-[12.5px] text-text-2">Each feature&apos;s effective state and why. Force-on grants beta access above the plan; force-off suspends it — inherit follows the plan + the practice&apos;s own toggle.</p>
            <OrgFeaturePanel orgId={id} resolutions={featureResolutions} />
          </div>
        </Card>
      )}

      {/* Notification credits (manual top-up until Phase 15.1) */}
      <Card>
        <CardHead title="Notification credits" />
        <div className="px-[17px] pb-[17px]">
          <GrantCredits orgId={id} balances={credits} />
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
