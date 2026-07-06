import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Company verification status, surfaced in Settings → Organisation. Reflects the
 * onboarding lifecycle + a summary of the submitted legal details, and links to the
 * full verification flow (`/hub/verification`) which is the source of truth.
 */
export function VerificationStatusCard({ status, profile }: { status: string; profile: Record<string, string> }) {
  const map: Record<string, { icon: typeof ShieldCheck; cls: string; label: string; body: string }> = {
    verified: { icon: BadgeCheck, cls: "text-accent", label: "Verified", body: "Your practice is verified — payouts and funder reporting are unlocked." },
    submitted: { icon: Clock, cls: "text-info", label: "Under review", body: "We're reviewing your details — we'll email you the moment it's approved." },
    action_needed: { icon: TriangleAlert, cls: "text-warn", label: "Action needed", body: "A document was sent back — update it and resubmit." },
    not_started: { icon: ShieldCheck, cls: "text-text-3", label: "Not started", body: "Complete your company profile and documents to unlock payouts and funder reporting." },
  };
  const s = map[status] ?? map.not_started!;
  const Icon = s.icon;

  const summary: [string, string | undefined][] = [
    ["Registration no.", profile.registrationNo],
    ["VAT number", profile.vatNo],
    ["HPCSA practice no.", profile.practiceNo],
    ["Information Officer", profile.infoOfficerName],
  ];
  const filled = summary.filter(([, v]) => v);

  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-control bg-surface-2", s.cls)}>
          <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-[640] text-text">Company verification</span>
            <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", s.cls === "text-accent" ? "bg-accent-soft text-accent" : s.cls === "text-info" ? "bg-info-soft text-info" : s.cls === "text-warn" ? "bg-warn-soft text-warn" : "bg-surface-2 text-text-3")}>{s.label}</span>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-2">{s.body}</p>
        </div>
        <Link href="/hub/verification" className="inline-flex shrink-0 items-center gap-1 rounded-control border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
          {status === "verified" ? "Review" : "Open"} <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden />
        </Link>
      </div>

      {filled.length > 0 && (
        <div className="grid gap-x-6 gap-y-2 rounded-control bg-surface-2/40 p-3.5 sm:grid-cols-2">
          {filled.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-3">{label}</div>
              <div className="truncate text-[12.5px] text-text">{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
