import { cn } from "@/lib/utils";

export interface DonutDatum {
  label: string;
  value: number;
  /** k-anon suppressed / "other"  drawn in a muted grey and never a bright colour. */
  muted?: boolean;
}

/** On-brand data palette  accent-led, harmonious, distinct in light + dark. */
const PALETTE = ["#1C7D58", "#4FA97F", "#86C7A6", "#D8A72E", "#5B84D6", "#B5628A", "#7A8896"];
const MUTED = "#C3C8CE";

/**
 * A calm donut chart (SVG, no dependency). Sorts by size, folds the tail into
 * "Other" past `maxSegments`, shows the total in the centre, and a legend with
 * share %. Muted data (e.g. k-anon suppressed) reads grey, never a bright wedge.
 */
export function DonutChart({
  data,
  centerLabel,
  centerCaption,
  maxSegments = 6,
  size = 132,
  thickness = 15,
}: {
  data: DonutDatum[];
  centerLabel?: string | number;
  centerCaption?: string;
  maxSegments?: number;
  size?: number;
  thickness?: number;
}) {
  const clean = data.filter((d) => d.value > 0);
  const total = clean.reduce((s, d) => s + d.value, 0);

  // Sort by size; fold the long tail into a single muted "Other".
  const sorted = [...clean].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSegments);
  const tail = sorted.slice(maxSegments);
  const segments: DonutDatum[] =
    tail.length > 0 ? [...head, { label: "Other", value: tail.reduce((s, d) => s + d.value, 0), muted: true }] : head;

  const r = 50 - thickness / 2;
  const circ = 2 * Math.PI * r;
  const gap = segments.length > 1 ? 1.4 : 0; // subtle wedge separation

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const frac = total > 0 ? seg.value / total : 0;
    const len = Math.max(0, frac * circ - gap);
    const dash = `${len} ${circ - len}`;
    const dashOffset = -offset;
    offset += frac * circ;
    return { key: `${seg.label}-${i}`, color: seg.muted ? MUTED : PALETTE[i % PALETTE.length]!, dash, dashOffset };
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="-rotate-90" style={{ width: size, height: size }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-2, #eef0f1)" strokeWidth={thickness} />
          {total > 0 &&
            arcs.map((a) => (
              <circle key={a.key} cx="50" cy="50" r={r} fill="none" stroke={a.color} strokeWidth={thickness} strokeDasharray={a.dash} strokeDashoffset={a.dashOffset} strokeLinecap="butt" />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[19px] font-[680] leading-none tabular-nums text-text">{centerLabel ?? total}</span>
          {centerCaption ? <span className="mt-0.5 max-w-[74px] text-[10px] leading-tight text-text-3">{centerCaption}</span> : null}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {total === 0 ? (
          <li className="text-[12.5px] text-text-3">No data yet.</li>
        ) : (
          segments.map((seg, i) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            return (
              <li key={`${seg.label}-${i}`} className="flex items-center gap-2 text-[12.5px]">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: seg.muted ? MUTED : PALETTE[i % PALETTE.length] }} aria-hidden />
                <span className={cn("min-w-0 flex-1 truncate", seg.muted ? "text-text-3" : "text-text-2")}>{seg.label}</span>
                <span className="shrink-0 tabular-nums font-medium text-text">{seg.value}</span>
                <span className="w-9 shrink-0 text-right tabular-nums text-text-3">{pct}%</span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
