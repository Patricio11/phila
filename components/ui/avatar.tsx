import { cn, hashString, initials } from "@/lib/utils";

/**
 * Avatar — deterministic coloured initials by name (DESIGN.md §6). A credential
 * ring marks a verified counsellor; honesty matters, so it is opt-in, never the
 * default. Palette stays within the calm system (no rainbow).
 */
const PALETTE = [
  "bg-[#E5F1EB] text-[#1C7D58] dark:bg-[#1b2f27] dark:text-[#5cd3a0]",
  "bg-[#E2ECF3] text-[#3C7FB0] dark:bg-[#1c2a33] dark:text-[#73b0d6]",
  "bg-[#F6ECDD] text-[#9a6418] dark:bg-[#322a1c] dark:text-[#d9a865]",
  "bg-[#EFEAF4] text-[#6b4f8a] dark:bg-[#2a2433] dark:text-[#b193d6]",
  "bg-[#E8EEE9] text-[#4a615a] dark:bg-[#222a27] dark:text-[#93a8a0]",
];

const SIZE = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-[13px]",
  lg: "size-12 text-base",
} as const;

export function Avatar({
  name,
  size = "md",
  verified = false,
  className,
}: {
  name: string;
  size?: keyof typeof SIZE;
  verified?: boolean;
  className?: string;
}) {
  const tone = PALETTE[hashString(name) % PALETTE.length]!;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZE[size],
        tone,
        verified && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
