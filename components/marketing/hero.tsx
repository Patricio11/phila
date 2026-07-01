import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductFrame } from "@/components/marketing/product-frame";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";

const TRUST = [
  "POPIA-grade by design",
  "Client data stays in South Africa",
  "No medical-aid claims, ever",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* On-brand glow  opacity/transform only, drifts slowly. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="drift absolute left-1/2 top-[-12%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] opacity-80 blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,var(--bg))]" />
      </div>

      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-20">
        {/* Copy */}
        <div className="rise-stagger lg:col-span-5">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-[12px] font-medium text-text-2 shadow-sm">
            <ShieldCheck className="size-3.5 text-accent" strokeWidth={2} aria-hidden />
            For South African counselling organisations
          </span>

          <h1 className="mt-5 text-[clamp(2.1rem,5vw,3.4rem)] font-[720] leading-[1.05] tracking-[-0.035em] text-text">
            Run the practice.
            <br />
            <span className="text-accent">Hold the whole journey.</span>
          </h1>

          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-text-2">
            The calm operating system for counselling teams  booking, sessions, the team and its
            documents, invoicing, and funder reporting in one place. The reporting falls out of the
            work instead of being a second job.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started
                <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href="mailto:hello@philasa.com?subject=Phila%20walkthrough">Book a walkthrough</a>
            </Button>
          </div>

          <ul className="mt-8 space-y-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-[13.5px] text-text-2">
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Check className="size-3" strokeWidth={2.6} aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* The real product */}
        <div className="rise lg:col-span-7" style={{ animationDelay: "0.12s" }}>
          <div className="float">
            <ProductFrame className="mx-auto max-w-[640px] lg:ml-auto lg:mr-0">
              <DashboardPreview />
            </ProductFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
