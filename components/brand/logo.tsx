import { cn } from "@/lib/utils";

/**
 * The Phila mark  a **protea bloom**, stylised calm. The king protea is South
 * Africa's national flower: it survives fire and regrows  resilience, renewal,
 * and quiet strength, the spirit of the work. Drawn as a soft, layered bloom in
 * `currentColor` so it sits white on the brand's green→mint tile (sidebar, app
 * icon, auth art, public pages). Broad bracts open from a rounded heart, with a
 * short inner tier for depth; it stays legible from favicon size up.
 */
const PETAL = "M0 0C-48 -46 -52 -116 0 -172C52 -116 48 -46 0 0Z";
// [angle°, length scale]  outer bracts fan into the crown; inner tier adds depth.
const OUTER: readonly [number, number][] = [[-72, 0.8], [-48, 0.9], [-24, 0.97], [0, 1], [24, 0.97], [48, 0.9], [72, 0.8]];
const INNER: readonly [number, number][] = [[-58, 0.52], [-34, 0.56], [-11, 0.58], [11, 0.58], [34, 0.56], [58, 0.52]];

export function PhilaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden>
      <g transform="translate(256 256) scale(1.15) translate(-256 -260)">
        {OUTER.map(([a, s]) => (
          <path key={`o${a}`} d={PETAL} transform={`translate(256 336) rotate(${a}) scale(${s})`} />
        ))}
        {INNER.map(([a, s]) => (
          <path key={`i${a}`} d={PETAL} transform={`translate(256 336) rotate(${a}) scale(${s})`} />
        ))}
        {/* rounded heart */}
        <circle cx="256" cy="300" r="78" />
      </g>
    </svg>
  );
}

/**
 * The brand mark in its tile: the protea in a small green→mint gradient square,
 * the way it appears in the sidebar header, the app icon, and public pages.
 */
export function BrandMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent to-[#34bc83] text-white shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <PhilaGlyph className="h-[78%] w-[78%]" />
    </span>
  );
}
