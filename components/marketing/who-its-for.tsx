import { Building2, GraduationCap, HandHeart, HeartHandshake } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const AUDIENCES = [
  { icon: HandHeart, title: "Community & NGO counselling", body: "Multi-counsellor teams serving clients directly, with funders to report to and demographics to track." },
  { icon: Building2, title: "EAP & corporate wellness", body: "Employee-assistance providers running caseloads across employers, with utilisation and outcomes to show." },
  { icon: GraduationCap, title: "University & student services", body: "Campus counselling centres with high volume, intake forms, and waitlists to manage calmly." },
  { icon: HeartHandshake, title: "Faith-based & community services", body: "Mission-driven services that bill clients directly and scale down to a single practice." },
];

/** Who Phila is for — multi-counsellor orgs that bill clients directly. */
export function WhoItsFor() {
  return (
    <section id="who" className="mx-auto w-full max-w-[1120px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="Who it's for"
        title="Built for organisations the billing incumbents serve badly"
        lead="Not a medical-aid claims tool, and not a solo-therapist scheduler. Phila is for multi-counsellor organisations that bill clients directly — and it scales down to a single practice as the entry tier."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map((a, i) => (
          <Reveal key={a.title} delay={i * 80}>
            <div className="h-full rounded-card border border-border bg-surface p-5 shadow-sm transition-shadow duration-200 hover:shadow-[var(--shadow-card)]">
              <span className="inline-flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent">
                <a.icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-[640] tracking-[-0.01em] text-text">{a.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{a.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
