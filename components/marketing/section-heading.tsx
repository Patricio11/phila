import { cn } from "@/lib/utils";
import { Reveal } from "@/components/marketing/reveal";

/**
 * A consistent section header — small accent eyebrow, a tight title, a calm lead.
 * Plain and specific copy (DESIGN.md §7); centred or left per section.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
        className,
      )}
    >
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-accent">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.3rem)] font-[680] leading-[1.12] tracking-[-0.03em] text-text">
        {title}
      </h2>
      {lead ? <p className="mt-3.5 text-[15.5px] leading-relaxed text-text-2">{lead}</p> : null}
    </Reveal>
  );
}
