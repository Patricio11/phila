import { Database, FileLock2, KeyRound, MapPin, ScrollText, UserCheck } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const POINTS = [
  { icon: MapPin, title: "Data stays in South Africa", body: "Client PII rests in an SA region before launch. AI inference is de-identified before any cross-border call, on a zero-retention provider  audio is never stored." },
  { icon: UserCheck, title: "Consent before capture", body: "Every purpose  notes, demographics, comms, AI, funder reporting  is independently granted, versioned, and revocable. Off means nothing leaves." },
  { icon: ScrollText, title: "Audited by design", body: "Every read of a note, contact, or demographic writes an audit row. The Hub seeing a note is a recorded access  never silent." },
  { icon: Database, title: "Tenant isolation", body: "Every query is bounded to its org by Postgres row-level security  the database itself refuses a cross-org row, not just the app." },
  { icon: KeyRound, title: "Encrypted where it counts", body: "ID numbers and special-category fields are encrypted at the field level. We never store sensitive data in the clear." },
  { icon: FileLock2, title: "Compliance you can show", body: "A one-click POPIA pack  consent records, lawful basis, audit, retention  ready for the Information Regulator." },
];

/** The specific POPIA / data-in-SA trust band  concrete, not slogans. */
export function TrustBand() {
  return (
    <section id="trust" className="scroll-mt-20 bg-surface-2/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="Trust is the product"
          title="Built for the most sensitive data there is"
          lead="Counselling notes, demographics, sometimes GBV survivors  under POPIA, all of it is special personal information. Phila treats it that way from the first commit, not as a launch checklist."
        />

        <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={(i % 3) * 80}>
              <div className="h-full bg-surface p-6">
                <span className="inline-flex size-9 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <p.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="mt-3.5 text-[14.5px] font-[640] text-text">{p.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
