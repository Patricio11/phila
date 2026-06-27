import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { requireFunder } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "@/components/ui/tag";

export const dynamic = "force-dynamic";

function rands(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
function period(start: string, end: string): string {
  const f = (d: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(`${d}T12:00:00Z`));
  return `${f(start)} – ${f(end)}`;
}

export default async function FunderHomePage() {
  const principal = await requireFunder();
  const provider = await getDataProvider();
  const grants = await provider.listFunderGrants(principal.userId);

  await logAccess({
    action: "funder.view",
    actor: { userId: principal.userId, platformRole: "funder", teamRole: null },
    orgId: null,
    target: "funder:grants",
    reason: "list_scoped_grants",
  });

  const firstName = principal.name.split(" ")[0];

  return (
    <div className="rise space-y-6">
      <PageHead title={`Welcome, ${firstName}`} summary="Live progress on the grants you fund." />

      {grants.length === 0 ? (
        <Card className="p-2">
          <EmptyState icon={Target} title="No grants yet" body="When an organisation invites you to a grant, it appears here." />
        </Card>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat value={rands(grants.reduce((s, g) => s + g.grant.amountCents, 0))} label="Committed" />
          <Stat value={String(grants.length)} label={`Grant${grants.length === 1 ? "" : "s"}`} />
          <Stat value={String(grants.filter((g) => g.grant.status === "active").length)} label="Active" />
          <Stat value={String(new Set(grants.map((g) => g.orgName)).size)} label="Organisations" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {grants.map(({ grant, orgName }) => (
            <Link
              key={grant.id}
              href={`/funder/grants/${grant.id}`}
              className="group block rounded-card border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-[660] tracking-[-0.01em] text-text">{grant.title}</h3>
                  <p className="mt-0.5 text-[12.5px] text-text-2">{orgName}</p>
                </div>
                <Tag tone={grant.status === "active" ? "accent" : "neutral"}>{grant.status}</Tag>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12.5px]">
                <span className="text-text-3">{period(grant.periodStart, grant.periodEnd)}</span>
                <span className="font-semibold tabular-nums text-text">{rands(grant.amountCents)}</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
                View progress <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} aria-hidden />
              </div>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="truncate text-[20px] font-bold tabular-nums text-text">{value}</div>
      <div className="text-[12px] text-text-2">{label}</div>
    </div>
  );
}
