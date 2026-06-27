import { Eye, Lock, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { ProductFrame } from "@/components/marketing/product-frame";
import { Card, CardHead } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

const GUARANTEES = [
  { icon: Eye, title: "Read-only & scoped", body: "A funder sees only their own grant  never another, never the org's inner workings." },
  { icon: Lock, title: "Nothing identifiable", body: "Aggregate, k-anonymised, consent-gated. Small cells are suppressed, not shown." },
  { icon: ShieldCheck, title: "Every view audited", body: "The org controls exactly what each funder sees, and every view is recorded." },
];

/** The growth-loop differentiator  a scoped, k-anon, read-only funder portal. */
export function FunderStory() {
  return (
    <section id="funders" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-accent">
            For funders
          </span>
          <h2 className="mt-3 text-[clamp(1.6rem,3.2vw,2.3rem)] font-[680] leading-[1.14] tracking-[-0.03em] text-text">
            Give funders live proof  without giving away a single client.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-text-2">
            Invite a funder to a portal scoped to their grant. They watch indicators move against
            targets in real time  the same numbers that fall out of your counsellors&apos; daily work. No
            spreadsheets, no quarter-end scramble, no identifiable client ever in view.
          </p>

          <ul className="mt-6 space-y-4">
            {GUARANTEES.map((g) => (
              <li key={g.title} className="flex gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <g.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
                </span>
                <div>
                  <div className="text-[14px] font-[620] text-text">{g.title}</div>
                  <div className="text-[13.5px] leading-relaxed text-text-2">{g.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <ProductFrame url="philasa.com/funder">
            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-[680] tracking-[-0.01em] text-text">
                    DSD Community Wellness Grant
                  </div>
                  <div className="text-[11.5px] text-text-3">Apr–Jun 2026 · quarterly report</div>
                </div>
                <Tag tone="accent">Aggregate · anonymised</Tag>
              </div>

              <Card>
                <CardHead title="Indicators vs target" />
                <div className="space-y-3.5 px-3.5 pb-4">
                  {[
                    { label: "Unique clients reached", a: 312, t: 300, u: "", on: true },
                    { label: "Female participants", a: 58, t: 60, u: "%", on: false },
                    { label: "Improved ≥5 on PHQ-9", a: 71, t: 70, u: "%", on: true },
                    { label: "Sessions delivered", a: 1840, t: 1800, u: "", on: true },
                  ].map((m) => {
                    const pct = Math.min(100, Math.round((m.a / m.t) * 100));
                    return (
                      <div key={m.label}>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-text-2">{m.label}</span>
                          <span className="font-semibold tabular-nums text-text">
                            {m.a}
                            {m.u} <span className="font-normal text-text-3">/ {m.t}{m.u}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className={`h-full rounded-full ${m.on ? "bg-accent" : "bg-warn"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-text-3">412 of 530 clients have consented demographics.</p>
                </div>
              </Card>
            </div>
          </ProductFrame>
        </Reveal>
      </div>
    </section>
  );
}
