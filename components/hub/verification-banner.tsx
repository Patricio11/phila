import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The hub go-live gate (W1.8). A calm, dismissable-feeling nudge (not a wall) shown
 * until the practice is verified. It never blocks the trial  it points to the
 * company-verification step that unlocks payouts + funder reporting.
 */
export function VerificationBanner({ status }: { status: string }) {
  if (status === "verified") return null;

  const map: Record<string, { icon: typeof ShieldCheck; wrap: string; chip: string; title: string; body: string; cta: string }> = {
    not_started: {
      icon: ShieldCheck,
      wrap: "border-accent/30 bg-accent-soft/30",
      chip: "bg-accent text-accent-ink",
      title: "Complete your company profile to go fully live",
      body: "Add your registration details and documents to unlock client payouts and funder reporting. It won't interrupt your free trial.",
      cta: "Start verification",
    },
    submitted: {
      icon: Clock,
      wrap: "border-info/30 bg-info-soft/30",
      chip: "bg-info text-white",
      title: "Verification under review",
      body: "Thanks  we're checking your details and will email you the moment your practice is approved.",
      cta: "View status",
    },
    action_needed: {
      icon: TriangleAlert,
      wrap: "border-warn/40 bg-warn-soft/40",
      chip: "bg-warn text-white",
      title: "Verification needs a quick fix",
      body: "One or more of your documents were sent back. Update them and resubmit  we'll review again right away.",
      cta: "Fix & resubmit",
    },
  };
  const s = map[status] ?? map.not_started!;
  const Icon = s.icon;

  return (
    <Link href="/hub/verification" className={cn("group flex items-center gap-3.5 rounded-card border p-4 transition-colors hover:brightness-[0.99]", s.wrap)}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-control", s.chip)}>
        <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13.5px] font-[640] text-text">
          {s.title}
          {status === "not_started" && <BadgeCheck className="size-3.5 text-accent" strokeWidth={2.2} aria-hidden />}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-2">{s.body}</p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 text-[12.5px] font-medium text-accent group-hover:underline sm:inline-flex">
        {s.cta} <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden />
      </span>
    </Link>
  );
}
