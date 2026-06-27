import { Phone, ShieldAlert } from "lucide-react";

/**
 * SafeguardingPanel (DESIGN.md §6 / Safeguarding Rule) — rose, always paired with
 * a human + current South African support. Never auto-actioned, and it never
 * names a method. Resources verified at build; review at each release.
 */
export function SafeguardingPanel({ clientName }: { clientName?: string }) {
  return (
    <div className="rounded-card border border-danger/25 bg-danger-soft/50 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-danger" strokeWidth={2} aria-hidden />
        <h3 className="text-[14px] font-[660] text-text">Safeguarding flag</h3>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-text-2">
        {clientName ? `${clientName.split(" ")[0]} has` : "This client has"} a safeguarding concern on
        record. Stay with them, involve your supervisor, and share current support. This flag is never
        auto-actioned — you decide the next step.
      </p>
      <ul className="mt-3 space-y-1.5 text-[12.5px] text-text-2">
        <li className="flex items-center gap-2">
          <Phone className="size-3.5 text-danger" strokeWidth={2} aria-hidden />
          <span>
            <span className="font-semibold text-text">SADAG</span> 24-hour helpline: 0800 567 567 ·
            SMS 31393
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Phone className="size-3.5 text-danger" strokeWidth={2} aria-hidden />
          <span>
            In immediate danger: <span className="font-semibold text-text">10111</span> (police) or{" "}
            <span className="font-semibold text-text">112</span> from a mobile
          </span>
        </li>
      </ul>
    </div>
  );
}
