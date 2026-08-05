"use client";

import { useRef, useState } from "react";

/**
 * Bookings-over-the-period area chart, in the house inline-SVG idiom (see
 * outcome-sparkline): one accent series — soft gradient fill, 2px stroke,
 * recessive gridlines, sparse x labels — plus a crosshair + tooltip on hover.
 * Single series, so the card title is the legend (dataviz rules).
 */
export function BookingsChart({ series }: { series: { label: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const W = 720, H = 180, PAD_L = 26, PAD_R = 8, PAD_T = 10, PAD_B = 22;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...series.map((s) => s.count));
  const yTicks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const n = series.length;
  const x = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;

  const line = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`;
  // Sparse x labels: aim for ~8.
  const step = Math.max(1, Math.ceil(n / 8));

  const onMove = (e: React.PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD_L) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const total = series.reduce((t, s) => t + s.count, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-[12.5px] text-text-3">No bookings in this period yet.</p>;
  }

  return (
    <div ref={wrapRef} className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bookings per day">
        <defs>
          <linearGradient id="bookings-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--text-3)">{t}</text>
          </g>
        ))}
        {series.map((s, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-3)">{s.label}</text>
        ))}
        <path d={area} fill="url(#bookings-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + innerH} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(hover)} cy={y(series[hover]!.count)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-control border border-border bg-surface px-2.5 py-1.5 text-[11.5px] shadow-[var(--shadow-card)]"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <span className="font-semibold tabular-nums text-text">{series[hover]!.count}</span>
          <span className="text-text-3"> booking{series[hover]!.count === 1 ? "" : "s"} · {series[hover]!.label}</span>
        </div>
      )}
    </div>
  );
}
