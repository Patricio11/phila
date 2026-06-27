import type { OutcomePoint } from "@/lib/data-provider";

/**
 * Outcome sparkline (DESIGN.md §6 chart language): a thin accent line with a soft
 * gradient fill, a tabular latest value, and a plain caption with coverage. No
 * chart-junk. For PHQ-9/GAD-7 a falling line is improvement, so we state the
 * direction in words rather than relying on colour.
 */
export function OutcomeSparkline({
  points,
  tool,
  coverage,
}: {
  points: OutcomePoint[];
  tool: string;
  coverage: string;
}) {
  if (points.length < 2) {
    return (
      <p className="px-1 py-6 text-center text-[12.5px] text-text-3">
        Not yet measured — outcome trends appear once two or more {tool} scores are captured.
      </p>
    );
  }

  const W = 320;
  const H = 84;
  const pad = 6;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / span);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - pad} L${x(0).toFixed(1)} ${H - pad} Z`;

  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  const improved = last < first; // lower is better for PHQ-9 / GAD-7
  const delta = Math.abs(last - first);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums text-text">
            {last}
          </div>
          <div className="mt-1 text-[12.5px] text-text-2">
            Latest {tool} score
          </div>
        </div>
        <div className="text-right text-[12px]">
          <span className={improved ? "font-semibold text-accent" : "font-semibold text-warn"}>
            {improved ? "↓" : "↑"} {delta} {improved ? "improved" : "higher"}
          </span>
          <div className="mt-0.5 text-text-3">since first measure</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-[84px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${tool} trend, latest score ${last}, ${improved ? "improved" : "increased"} by ${delta}`}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last)} r="3.5" fill="var(--accent)" />
      </svg>

      <p className="mt-2 text-[11.5px] text-text-3">{coverage}</p>
    </div>
  );
}
