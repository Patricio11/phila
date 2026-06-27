import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

/** What each role can honestly reach (the redaction matrix, in a word). */
export const ROLE_REACH: Record<TeamRole, string> = {
  org_admin: "Full oversight",
  counsellor: "Clinical · own clients",
  front_desk: "Scheduling · no notes",
  finance: "Billing · no clinical",
  programme_manager: "Reporting · aggregate only",
};

const TONE: Record<TeamRole, string> = {
  org_admin: "bg-accent-soft text-accent",
  counsellor: "bg-info-soft text-info",
  front_desk: "bg-surface-2 text-text-2",
  finance: "bg-warn-soft text-warn",
  programme_manager: "bg-surface-2 text-text-2",
};

export function TeamRoleChip({ role, className }: { role: TeamRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip px-2 py-0.5 text-[11.5px] font-semibold",
        TONE[role],
        className,
      )}
    >
      {TEAM_ROLE_LABELS[role]}
    </span>
  );
}
