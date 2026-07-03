import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PhilaMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

/** Calm close  one CTA, no pressure. */
export function ClosingCta() {
  return (
    <section id="contact" className="scroll-mt-20 px-4 pb-20 pt-8 sm:px-6">
      <Reveal>
        <div className="relative mx-auto w-full max-w-[1000px] overflow-hidden rounded-[20px] border border-border bg-surface px-6 py-14 text-center shadow-[var(--shadow-card)] sm:px-12 sm:py-20">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-40 bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] opacity-80"
            aria-hidden
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-[clamp(1.7rem,3.6vw,2.6rem)] font-[700] leading-[1.1] tracking-[-0.035em] text-text">
              Bring calm to your counselling practice.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-text-2">
              We&apos;ll walk you through Phila with your own services, intake, and reporting in mind 
              and set it up with you. No obligation, no pressure.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <a href="mailto:hello@philasa.com?subject=Phila%20walkthrough">
                  Book a walkthrough
                  <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
                </a>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const FOOTER_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "For funders", href: "#funders" },
  { label: "Trust & POPIA", href: "#trust" },
  { label: "Who it's for", href: "#who" },
  { label: "Terms", href: "/terms" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-2/50">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <PhilaMark size={30} />
          <div className="leading-tight">
            <div className="text-[15px] font-[650] tracking-[-0.01em] text-text">Phila</div>
            <div className="text-[11.5px] text-text-3">Made for South Africa · philasa.com</div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[13px] text-text-2 transition-colors hover:text-text">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-4 text-[11.5px] text-text-3 sm:px-6">
          Phila holds special personal information under POPIA and is built consent-first. We never
          diagnose, never name a competitor, and make no medical-aid claims. © {YEAR} Phila.
        </div>
      </div>
    </footer>
  );
}

// Static label; avoids a render-time clock (the year only matters for the notice).
const YEAR = "2026";
