import { SUB_PROCESSORS } from "@/lib/compliance/subprocessors";
import type { PopiaPack } from "@/db/queries/popia-pack";
import { CONSENT_PURPOSE_LABELS, type ConsentPurpose } from "@/lib/domain/enums";

/**
 * Phase 31.4 — the printable POPIA pack ("compliance you can show the
 * Information Regulator"). Print-first styling like the grant report pack:
 * plain hex palette, A4-friendly, no app shell. Assembly of evidence the
 * platform already holds — consent records, the access audit, retention
 * posture, breach entries, and Phila's sub-processor chain.
 */
function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function PopiaPackReport({ pack }: { pack: PopiaPack }) {
  const year = new Date(pack.generatedAt).getFullYear();
  return (
    <article className="mx-auto max-w-[760px] bg-white px-10 py-10 text-[12.5px] leading-relaxed text-[#1a1a1a] print:px-0 print:py-0">
      {/* Letterhead */}
      <header className="flex items-start justify-between border-b-2 border-[#0f5132] pb-4">
        <div>
          <div className="text-[19px] font-bold text-[#0f5132]">{pack.org.name}</div>
          <div className="text-[11.5px] text-[#555]">{pack.org.province} · POPIA compliance pack</div>
        </div>
        <div className="text-right text-[11.5px] text-[#555]">
          <div className="font-semibold text-[#1a1a1a]">Generated {longDate(pack.generatedAt)}</div>
          <div>Prepared with Phila · philasa.com</div>
        </div>
      </header>

      <p className="mt-4 text-[12px] text-[#444]">
        This pack assembles the organisation&apos;s live compliance evidence: recorded consent (purpose-bound, versioned),
        the personal-information access audit, HPCSA-aware retention posture, any breach-register entries, and the
        operator/sub-processor chain maintained centrally by Phila. Nothing here is manually compiled — it is generated
        from the records the practice already keeps by using the platform.
      </p>

      <Section n="1" title="Consent records (lawful-basis evidence)">
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr className="border-b border-[#ccc] text-left text-[10.5px] uppercase text-[#777]">
            <th className="py-1 pr-2">Purpose</th><th className="py-1 pr-2">Granted</th><th className="py-1">Revoked</th></tr></thead>
          <tbody>
            {pack.consents.map((c) => (
              <tr key={c.purpose} className="border-b border-[#eee]">
                <td className="py-1 pr-2">{CONSENT_PURPOSE_LABELS[c.purpose as ConsentPurpose] ?? c.purpose}</td>
                <td className="py-1 pr-2">{c.granted}</td>
                <td className="py-1">{c.revoked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-[11px] text-[#777]">{pack.consentTotal} consent records on file — each purpose-bound, versioned, and timestamped. Individual records are auditable in-app.</p>
      </Section>

      <Section n="2" title="Access audit (last 12 months)">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {pack.audit.last12mo.map((a) => (
            <span key={a.action} className="text-[11.5px] text-[#444]"><b className="text-[#1a1a1a]">{a.count}</b> {a.action}</span>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[#777]">{pack.audit.total12mo} recorded events. Clinical reads and every export are fail-strict: an access that cannot be recorded is refused. Most recent entries:</p>
        <table className="mt-1 w-full border-collapse text-[10.5px]">
          <tbody>
            {pack.audit.recent.slice(0, 15).map((r, i) => (
              <tr key={i} className="border-b border-[#f0f0f0]">
                <td className="py-0.5 pr-2 whitespace-nowrap text-[#777]">{r.at.slice(0, 16).replace("T", " ")}</td>
                <td className="py-0.5 pr-2">{r.action}</td>
                <td className="py-0.5 pr-2 text-[#555]">{r.target}</td>
                <td className="py-0.5 text-[#777]">{r.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n="3" title="Retention posture (POPIA × HPCSA)">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Client records" value={pack.retention.clients} />
          <Stat label="Standard clock (6y from last entry)" value={pack.retention.standard} />
          <Stat label="Minor rule (kept to age 21)" value={pack.retention.minor} />
          <Stat label="Clock lapsed (destruction lawful)" value={pack.retention.lapsed} />
          <Stat label="Legal holds" value={pack.retention.legalHolds} />
          <Stat label="Erased / de-identified" value={pack.retention.erased} />
        </div>
        <p className="mt-1.5 text-[11px] text-[#777]">Clocks are computed automatically from record facts (last entry, date of birth) — never configured by staff. Erasure requests are honoured where lawful and refused with a dated reason where HPCSA retention applies.</p>
      </Section>

      <Section n="4" title="Breach register (POPIA s22)">
        {pack.breaches.length === 0 ? (
          <p className="text-[11.5px] text-[#444]">No incidents affecting this organisation are on record.</p>
        ) : (
          <ul className="space-y-1.5">
            {pack.breaches.map((b) => (
              <li key={b.id} className="text-[11.5px] text-[#444]">
                <b className="text-[#1a1a1a]">{b.title}</b> · {b.severity} · {b.status} · occurred {b.occurredAt.slice(0, 10)}{b.containment ? ` · containment: ${b.containment}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n="5" title="Operator / sub-processor register (maintained by Phila)">
        <table className="w-full border-collapse text-[10.5px]">
          <thead><tr className="border-b border-[#ccc] text-left text-[10px] uppercase text-[#777]">
            <th className="py-1 pr-2">Provider</th><th className="py-1 pr-2">Service</th><th className="py-1">Cross-border basis (s72)</th></tr></thead>
          <tbody>
            {SUB_PROCESSORS.map((s) => (
              <tr key={s.name} className="border-b border-[#eee] align-top">
                <td className="py-1 pr-2 font-medium text-[#1a1a1a]">{s.name}{s.dormantByDefault ? " *" : ""}</td>
                <td className="py-1 pr-2">{s.service}</td>
                <td className="py-1">{s.crossBorder ?? "Stays in South Africa"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[10.5px] text-[#777]">* dormant-by-default — processes data only once the organisation switches the integration on.</p>
      </Section>

      <footer className="mt-8 border-t border-[#ccc] pt-3 text-[10.5px] leading-relaxed text-[#777]">
        Generated on demand from live records; the underlying consent, audit, and retention data remain queryable in
        the Phila console. This pack is compliance tooling, not legal advice. © {year} {pack.org.name}. Generated with
        Phila · philasa.com.
      </footer>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 border-b border-[#ddd] pb-1 text-[13.5px] font-bold text-[#0f5132]">{n}. {title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#ddd] p-2.5">
      <div className="text-[17px] font-bold text-[#1a1a1a]">{value}</div>
      <div className="text-[10px] leading-tight text-[#777]">{label}</div>
    </div>
  );
}
