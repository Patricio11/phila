import { cn } from "@/lib/utils";

/**
 * The Phila mark — a fine-line **aloe** (the indigenous SA healing plant:
 * resilient, medicinal), drawn in `currentColor` so it sits on the green
 * gradient tile in the sidebar, the app icon, and the auth art (DESIGN.md §7).
 * Line-art only — no fills — so it stays crisp at favicon size.
 */
export function AloeGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      stroke="currentColor"
      strokeWidth={22}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* central blade */}
      <path d="M256 446 C232 332 232 206 256 86 C280 206 280 332 256 446 Z" />
      {/* inner pair */}
      <path d="M256 446 C212 356 176 262 158 150 C204 244 240 342 256 446 Z" />
      <path d="M256 446 C300 356 336 262 354 150 C308 244 272 342 256 446 Z" />
      {/* outer pair */}
      <path d="M256 446 C196 402 142 344 100 268 C168 332 220 388 256 446 Z" />
      <path d="M256 446 C316 402 370 344 412 268 C344 332 292 388 256 446 Z" />
    </svg>
  );
}

/**
 * The brand mark as it appears in the sidebar header: the aloe in a small green
 * gradient tile. `size` controls the tile; the glyph scales within it.
 */
export function BrandMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-accent to-[#34bc83] text-white shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <AloeGlyph className="h-[62%] w-[62%]" />
    </span>
  );
}
