import Link from "next/link";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/domain/types";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

const rand = (cents: number) => `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;

function features(p: Plan): string[] {
  return [
    p.seats === null ? "Unlimited team seats" : `${p.seats} team seats`,
    p.rooms === null ? "Unlimited rooms" : `${p.rooms} consulting rooms`,
    p.aiTokens > 0 ? "AI scribe included" : "AI scribe as an add-on",
    p.videoMinutes > 0 ? `${p.videoMinutes} video minutes / month` : "Bring your own video link",
    p.messaging ? "WhatsApp + SMS reminders" : "Email reminders",
  ];
}

/** Pricing  the subscription tiers (Phase 15A catalogue). Visibility is gated by a
 * super-admin switch (Plans & billing), so it stays hidden until pricing is final. */
export function Pricing({ plans }: { plans: Plan[] }) {
  return (
    <section id="pricing" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="Simple, honest pricing"
          title="One plan per practice  no per-seat surprises"
          lead="Pick the tier that fits your team. Variable costs (AI, SMS, video) are metered with a hard cap, so a bill never runs away from you."
        />

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 70}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-card border bg-surface p-5",
                  p.popular ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-[680] text-text">{p.name}</h3>
                  {p.popular && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">Most popular</span>}
                  {p.ngo && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-text-2">NGO rate</span>}
                </div>
                <p className="mt-1 min-h-[34px] text-[12.5px] leading-snug text-text-2">{p.tagline}</p>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[26px] font-bold tracking-[-0.02em] text-text">{rand(p.priceCents)}</span>
                  <span className="text-[12.5px] text-text-3">/ month</span>
                </div>

                <ul className="mt-4 flex-1 space-y-2">
                  {features(p).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] text-text-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-accent" strokeWidth={2.4} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/signup?plan=${p.id}`}
                  className={cn(
                    "mt-5 inline-flex h-10 items-center justify-center rounded-control text-[13.5px] font-medium transition-colors",
                    p.popular ? "bg-accent text-accent-ink hover:bg-accent-hover" : "border border-border bg-surface text-text hover:bg-surface-hover",
                  )}
                >
                  Get started
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-center text-[12px] text-text-3">Prices exclude VAT. All tiers include POPIA tooling, the funder portal, and data kept in South Africa.</p>
      </div>
    </section>
  );
}
