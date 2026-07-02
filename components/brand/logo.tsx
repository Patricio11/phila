import { cn } from "@/lib/utils";

/**
 * The Phila mark  a **protea bloom**, stylised calm. The king protea is South
 * Africa's national flower: it survives fire and regrows  resilience, renewal,
 * and quiet strength, the spirit of the work. Broad bracts open from a rounded
 * heart. Used tile-less across the app: the gradient-filled `PhilaMark` on light
 * surfaces, and the `currentColor` `PhilaGlyph` on coloured/dark panels (e.g.
 * white on the auth brand panel). The favicon / PWA icon keep a solid tile
 * (`app/icon.svg`, `public/icons/icon.svg`) so they read as an app icon.
 */
const PETAL = "M0 0C-48 -46 -52 -116 0 -172C52 -116 48 -46 0 0Z";
// [angle°, length scale]  outer bracts fan into the crown; inner tier adds depth.
const OUTER: readonly [number, number][] = [[-72, 0.8], [-48, 0.9], [-24, 0.97], [0, 1], [24, 0.97], [48, 0.9], [72, 0.8]];
const INNER: readonly [number, number][] = [[-58, 0.52], [-34, 0.56], [-11, 0.58], [11, 0.58], [34, 0.56], [58, 0.52]];
/** viewBox cropped tight to the bloom, so the mark hugs whatever sits beside it. */
const VIEWBOX = "120 135 272 272";

function Bloom() {
  return (
    <>
      {OUTER.map(([a, s]) => (
        <path key={`o${a}`} d={PETAL} transform={`translate(256 336) rotate(${a}) scale(${s})`} />
      ))}
      {INNER.map(([a, s]) => (
        <path key={`i${a}`} d={PETAL} transform={`translate(256 336) rotate(${a}) scale(${s})`} />
      ))}
      <circle cx="256" cy="300" r="78" />
    </>
  );
}

/** The protea, gradient-filled  the default mark on light backgrounds. */
export function PhilaMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <svg viewBox={VIEWBOX} width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="phila-bloom" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1C7D58" />
          <stop offset="1" stopColor="#34BC83" />
        </linearGradient>
      </defs>
      <g fill="url(#phila-bloom)">
        <Bloom />
      </g>
    </svg>
  );
}

/**
 * The protea in `currentColor`  for coloured / dark panels where the gradient
 * wouldn't read (e.g. white on the auth brand panel). Size it with a `size-*`
 * or `h-*`/`w-*` class and set the colour via `text-*`.
 */
export function PhilaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} fill="currentColor" className={cn("shrink-0", className)} aria-hidden>
      <Bloom />
    </svg>
  );
}
