import { ArrowRight, CalendarDays, NotebookPen, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const STEPS = [
  {
    icon: CalendarDays,
    title: "Open the day",
    body: "The calendar, the caseload, and what needs you — one glance, one tap. The session you're in is right there.",
  },
  {
    icon: NotebookPen,
    title: "Hold the session",
    body: "Type alongside the room — live notes that autosave and never block. In person or online, it's the same calm surface.",
  },
  {
    icon: Sparkles,
    title: "Sign the note",
    body: "An AI draft you read, edit, and sign — you're the author of record. The structured fields feed reporting with zero double entry.",
  },
];

/** The daily loop — the heart of the product, shown as three honest steps. */
export function DailyLoop() {
  return (
    <section id="how" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="The daily loop"
        title="The clinical work is the product. Reporting is its by-product."
        lead="A counsellor opens Phila ten times a day because the loop — calendar to session to note — is faster than anything else they could reach for. Everything else is built around that."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 90} className="relative">
            <div className="h-full rounded-card border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-[var(--shadow-card)]">
              <span className="inline-flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent">
                <step.icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[12px] font-semibold tabular-nums text-text-3">
                  0{i + 1}
                </span>
                <h3 className="text-[16px] font-[640] tracking-[-0.01em] text-text">{step.title}</h3>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-text-2">{step.body}</p>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight
                className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 text-border-strong md:block"
                strokeWidth={1.9}
                aria-hidden
              />
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}
