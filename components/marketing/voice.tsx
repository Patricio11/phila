import { PhilaMark } from "@/components/brand/logo";
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
          <PhilaMark size={48} className="mx-auto block" />
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
