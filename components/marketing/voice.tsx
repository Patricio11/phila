import { AloeGlyph } from "@/components/brand/aloe-mark";
import { Reveal } from "@/components/marketing/reveal";

/**
 * One human voice  the relief Phila is built to give a counselling team. Framed
 * honestly as the reality we're solving, not a fabricated customer endorsement
 * (Honest Trust Signals  no fake claims until the warm org is live).
 */
export function Voice() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <span className="mx-auto inline-flex size-11 items-center justify-center rounded-[12px] bg-gradient-to-br from-accent to-[#34bc83] text-white shadow-sm">
            <AloeGlyph className="size-6" />
          </span>
          <blockquote className="mt-6 text-[clamp(1.4rem,3vw,2rem)] font-[600] leading-[1.3] tracking-[-0.02em] text-text">
            “Friday afternoons used to mean rebuilding the quarter from memory  who we saw, what
            changed, what each funder still needs. The reporting was a second job. Phila just has it.”
          </blockquote>
          <p className="mt-5 text-[13.5px] text-text-3">
            The week we built Phila to give back to counselling teams.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
