"use client";

import { useState } from "react";
import { Blocks, Building2, CalendarClock, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey = "organisation" | "scheduling" | "billing" | "integrations" | "security";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "organisation", label: "Organisation", icon: Building2 },
  { key: "scheduling", label: "Scheduling", icon: CalendarClock },
  { key: "billing", label: "Billing & plan", icon: Receipt },
  { key: "integrations", label: "Integrations", icon: Blocks },
  { key: "security", label: "Security", icon: ShieldCheck },
];

/**
 * Settings tabs  the org settings surface is broad (profile, scheduling, billing,
 * channels, security), so it's grouped into tabs instead of one long scroll. Each
 * panel is server-rendered and passed in as a node; all panels stay mounted (hidden
 * when inactive) so a half-filled form keeps its state when you switch tabs.
 */
export function SettingsTabs({
  organisation,
  scheduling,
  billing,
  integrations,
  security,
}: Record<TabKey, React.ReactNode>) {
  const [active, setActive] = useState<TabKey>("organisation");
  const panels: Record<TabKey, React.ReactNode> = { organisation, scheduling, billing, integrations, security };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        <div className="flex gap-1 rounded-card border border-border bg-surface p-1">
          {TABS.map((t) => {
            const on = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-control px-3.5 py-2 text-[13px] font-medium transition-colors",
                  on ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover hover:text-text",
                )}
              >
                <t.icon className="size-4" strokeWidth={2} aria-hidden /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {TABS.map((t) => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key} className="space-y-6">
          {panels[t.key]}
        </div>
      ))}
    </div>
  );
}
