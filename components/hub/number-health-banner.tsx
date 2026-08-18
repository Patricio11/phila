import Link from "next/link";
import { AlertTriangle, PhoneOff } from "lucide-react";
import { statusGuidance, sendsPaused, type NumberHealth } from "@/lib/messaging/whatsapp-health";

/**
 * Phase 34.3 - the hub-wide banner for a WhatsApp number Meta has flagged,
 * restricted or rated red. Renders NOTHING when the number is healthy (no dead
 * UI). Server component - the layout hands it the health.
 */
export function NumberHealthBanner({ health }: { health: NumberHealth | null }) {
  if (!health) return null;
  const guidance = statusGuidance(health);
  if (!guidance) return null;
  const paused = sendsPaused(health.status);
  const Icon = paused ? PhoneOff : AlertTriangle;
  return (
    <div className={paused ? "flex items-center gap-3 border-b border-danger/20 bg-danger-soft/40 px-4 py-2.5 sm:px-6" : "flex items-center gap-3 border-b border-warn/20 bg-warn-soft/40 px-4 py-2.5 sm:px-6"} data-testid="number-health-banner">
      <Icon className={paused ? "size-4 shrink-0 text-danger" : "size-4 shrink-0 text-warn"} strokeWidth={2} aria-hidden />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-text-2">
        <span className="font-medium text-text">{paused ? "WhatsApp sends are paused." : health.status === "flagged" ? "Your WhatsApp number is flagged by Meta." : `Your WhatsApp number's quality is ${health.quality}.`}</span>{" "}
        {guidance}
      </p>
      <Link href="/hub/settings/notifications" className="shrink-0 rounded-control border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-text hover:bg-surface-hover">View connection</Link>
    </div>
  );
}
