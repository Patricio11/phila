import type { GrantView } from "@/lib/data-provider";

const rands = (c: number) => `R${Math.round(c / 100).toLocaleString("en-ZA")}`;
function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}
const STATUS_LABEL: Record<string, string> = { on_track: "On track", at_risk: "At risk", behind: "Behind" };

/**
 * Funder / M&E report pack (W7) — a professional, print-ready monitoring report the
 * org generates for a funder (DSD / NLC / CSI). Everything a grantee report needs:
 * performance vs targets, reach & delivery, a k-anonymised participant profile,
 * outcomes, and the narrative. Prints cleanly to PDF (A4). Aggregate + k-anon only —
 * no identifiable client data ever leaves.
 */
export function GrantReportPack({ view, orgName, orgProvince, logoUrl, generatedAt }: {
  view: GrantView;
  orgName: string;
  orgProvince: string;
  logoUrl: string | null;
  generatedAt: string;
}) {
  const { grant, funder, indicators, breakdowns, outcome, narratives, headline, allocatedCount, withDemographics, periodElapsedPct } = view;

  const sessions = indicators.find((i) => i.indicator.metric === "sessions_delivered")?.actual;
  const uniqueClients = indicators.find((i) => i.indicator.metric === "unique_clients")?.actual ?? allocatedCount;
  const first = outcome.points[0]?.value;
  const last = outcome.points[outcome.points.length - 1]?.value;
  const phqDrop = first != null && last != null ? first - last : null;

  return (
    <article className="report mx-auto max-w-[820px] bg-white px-10 py-9 text-[13px] leading-relaxed text-[#1a1a1a] print:max-w-none print:px-0 print:py-0">
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#0f5132] pb-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-12 rounded object-contain" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded bg-[#0f5132] text-[16px] font-bold text-white">{orgName.slice(0, 2).toUpperCase()}</span>
          )}
          <div>
            <div className="text-[17px] font-bold text-[#0f5132]">{orgName}</div>
            <div className="text-[12px] text-[#555]">{orgProvince} · Monitoring &amp; Evaluation Report</div>
          </div>
        </div>
        <div className="text-right text-[11.5px] text-[#555]">
          <div className="font-semibold text-[#1a1a1a]">Prepared {longDate(generatedAt)}</div>
          <div>Reporting to {funder.name}</div>
        </div>
      </header>

      <h1 className="mt-6 text-[22px] font-bold tracking-[-0.01em]">{grant.title}</h1>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[#555]">
        <span><b className="text-[#1a1a1a]">Funder:</b> {funder.name}</span>
        <span><b className="text-[#1a1a1a]">Period:</b> {longDate(grant.periodStart)} – {longDate(grant.periodEnd)} ({periodElapsedPct}% elapsed)</span>
        <span><b className="text-[#1a1a1a]">Committed:</b> {rands(grant.amountCents)}</span>
        <span className="capitalize"><b className="text-[#1a1a1a]">Schedule:</b> {grant.reportingSchedule}</span>
      </div>

      {/* 1 · Executive summary */}
      <Section n="1" title="Executive summary">
        <p>{headline || "Delivery is under way against the agreed targets."}</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Kpi label="Clients reached" value={String(uniqueClients)} />
          <Kpi label="Sessions delivered" value={sessions != null ? String(sessions) : "—"} />
          <Kpi label="Improved ≥5 on PHQ-9" value={phqImprovedLabel(indicators)} />
        </div>
      </Section>

      {/* 2 · Performance against indicators */}
      <Section n="2" title="Performance against indicators">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[#ccc] text-left text-[11px] uppercase tracking-wide text-[#666]">
              <th className="py-1.5 pr-2 font-semibold">Indicator</th>
              <th className="py-1.5 px-2 text-right font-semibold">Target</th>
              <th className="py-1.5 px-2 text-right font-semibold">Achieved</th>
              <th className="py-1.5 px-2 text-right font-semibold">Expected by now</th>
              <th className="py-1.5 pl-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((i) => (
              <tr key={i.indicator.id} className="border-b border-[#eee]">
                <td className="py-1.5 pr-2">{i.indicator.name}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{i.indicator.target}{unit(i.indicator.unit)}</td>
                <td className="py-1.5 px-2 text-right font-semibold tabular-nums">{i.actual}{unit(i.indicator.unit)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[#666]">{i.expected != null ? i.expected + unit(i.indicator.unit) : "—"}</td>
                <td className="py-1.5 pl-2">{STATUS_LABEL[i.status] ?? i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 3 · Participant profile (k-anon) */}
      <Section n="3" title="Participant profile" note="Aggregate, k-anonymised — small cells are suppressed to protect participants (POPIA).">
        <div className="grid grid-cols-3 gap-5">
          <Breakdown title="By gender" rows={breakdowns.byGender} />
          <Breakdown title="By age band" rows={breakdowns.byAgeBand} />
          <Breakdown title="By province" rows={breakdowns.byProvince} />
        </div>
        <p className="mt-2 text-[11px] text-[#777]">Based on {withDemographics} of {allocatedCount} participants who consented to share demographics.</p>
      </Section>

      {/* 4 · Outcomes */}
      <Section n="4" title="Outcomes">
        {phqDrop != null ? (
          <p>Across measured participants, the average PHQ-9 score moved from <b>{first}</b> to <b>{last}</b> over the period — a {phqDrop >= 0 ? "reduction" : "change"} of <b>{Math.abs(phqDrop)} points</b> ({outcome.coverage.captured} of {outcome.coverage.total} measured). Lower PHQ-9 scores indicate reduced depression symptoms.</p>
        ) : (
          <p>Outcome measurement is under way; a trend appears once two or more PHQ-9 scores are captured per participant.</p>
        )}
      </Section>

      {/* 5 · Narrative report */}
      {narratives.length > 0 && (
        <Section n="5" title="Narrative report">
          <div className="space-y-3">
            {narratives.map((nr) => (
              <div key={nr.id}>
                <div className="text-[11px] text-[#777]">{longDate(nr.postedAt)} · {nr.author}</div>
                <p className="mt-0.5 whitespace-pre-line">{nr.body}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <footer className="mt-8 border-t border-[#ccc] pt-3 text-[10.5px] leading-relaxed text-[#777]">
        This report contains aggregate, k-anonymised figures only — no participant is identifiable. Prepared under POPIA;
        participant consent is recorded and auditable. © {new Date(generatedAt).getFullYear()} {orgName}. Generated with Phila · philasa.com.
      </footer>
    </article>
  );
}

function unit(u: string): string {
  return u === "%" ? "%" : "";
}
function phqImprovedLabel(indicators: GrantView["indicators"]): string {
  const i = indicators.find((x) => x.indicator.metric === "phq9_improved_5");
  return i ? `${i.actual}%` : "—";
}

function Section({ n, title, note, children }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#0f5132]">{n}. {title}</h2>
      {note && <p className="mt-0.5 text-[11px] italic text-[#777]">{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#ddd] bg-[#f7f9f8] px-3 py-2.5">
      <div className="text-[20px] font-bold tabular-nums text-[#0f5132]">{value}</div>
      <div className="text-[11px] text-[#555]">{label}</div>
    </div>
  );
}
function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number | null; suppressed: boolean }[] }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#666]">{title}</div>
      <ul className="space-y-0.5">
        {rows.length === 0 && <li className="text-[12px] text-[#999]">—</li>}
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between gap-2 text-[12px]">
            <span className="truncate text-[#444]">{r.label}</span>
            <span className="shrink-0 tabular-nums text-[#1a1a1a]">{r.suppressed ? "≤4*" : r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
