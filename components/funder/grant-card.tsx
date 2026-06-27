import Link from "next/link";
import { ArrowRight, CalendarRange, Target, Users } from "lucide-react";
import type { GrantSummary } from "@/lib/data-provider";
import type { FunderType } from "@/lib/domain/enums";
import { Tag } from "@/components/ui/tag";

const FUNDER_TYPE_LABEL: Record<FunderType, string> = {
  government: "Government",
  lottery: "Lottery",
  corporate_csi: "Corporate CSI",
  foundation: "Foundation",
  international: "International",
};

function rands(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
function period(start: string, end: string): string {
  const f = (d: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(`${d}T12:00:00Z`));
  return `${f(start)} – ${f(end)}`;
}

export function GrantCard({ summary }: { summary: GrantSummary }) {
  const { grant, funder, indicatorCount, allocatedCount } = summary;
  return (
    <Link
      href={`/hub/grants/${grant.id}`}
      className="group block rounded-card border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-[660] tracking-[-0.01em] text-text">{grant.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-text-2">{funder.name}</p>
        </div>
        <Tag tone={grant.status === "active" ? "accent" : "neutral"}>{grant.status}</Tag>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Tag tone="neutral">{FUNDER_TYPE_LABEL[funder.type]}</Tag>
        {grant.restricted && <Tag tone="neutral">Restricted</Tag>}
        <Tag tone="neutral" className="capitalize">{grant.reportingSchedule}</Tag>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[12px]">
        <Meta icon={<CalendarRange className="size-3.5" />} value={period(grant.periodStart, grant.periodEnd)} />
        <Meta icon={<Target className="size-3.5" />} value={`${indicatorCount} indicators`} />
        <Meta icon={<Users className="size-3.5" />} value={`${allocatedCount} tagged`} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold tabular-nums text-text">{rands(grant.amountCents)}</span>
        <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
          Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function Meta({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1 text-text-3">
      <span aria-hidden>{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}
