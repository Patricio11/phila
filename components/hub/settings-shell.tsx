"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Blocks, Building2, CalendarClock, ChevronRight, MessagesSquare, Receipt, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Settings shell (batch 4h). A settings surface this broad wants two levels:
 * SECTIONS (Organisation · Scheduling · Messaging · Billing · Integrations ·
 * Security) and, inside each, PANELS (Profile · Branding · Client portal …).
 *
 *  - Desktop: a left rail of sections (icon, label, one-line blurb, live
 *    status chip) with the active section on the right; sub-panels as an
 *    underlined tab row under the section header.
 *  - Mobile: the rail folds into a horizontally scrolling pill strip; the
 *    sub-tabs scroll too. Nothing ever scrolls sideways at page level.
 *  - URL-linked: `?tab=integrations&sub=connections` deep-links a panel and
 *    stays honest through back/forward; every panel stays MOUNTED (hidden when
 *    inactive) so a half-filled form keeps its state when you look elsewhere.
 *  - Motion: the incoming panel rises; the rail's active marker slides.
 *
 * Server pages describe the sections (icons by KEY - functions can't cross the
 * server→client boundary) and hand every panel in already rendered.
 */
export type SettingsIconKey = "organisation" | "scheduling" | "messaging" | "billing" | "integrations" | "security";

const ICONS: Record<SettingsIconKey, LucideIcon> = {
  organisation: Building2, scheduling: CalendarClock, messaging: MessagesSquare, billing: Receipt, integrations: Blocks, security: ShieldCheck,
};

export interface SettingsPanel {
  key: string;
  label: string;
  /** One line under the sub-tab row when this panel is active. */
  hint?: string;
  node: React.ReactNode;
  /** A small chip beside the sub-tab label (e.g. "Verified", "3 on"). */
  badge?: string;
  badgeTone?: "accent" | "warn" | "muted";
}

export interface SettingsSection {
  key: string;
  label: string;
  icon: SettingsIconKey;
  blurb: string;
  /** A live status chip on the rail item (e.g. "Verified", "2 channels on"). */
  status?: { label: string; tone?: "accent" | "warn" | "muted" };
  panels: SettingsPanel[];
}

export function SettingsShell({ sections }: { sections: SettingsSection[] }) {
  const params = useSearchParams();
  const first = sections[0]!;
  const reqTab = params.get("tab");
  const reqSub = params.get("sub");
  const initialTab = sections.some((s) => s.key === reqTab) ? (reqTab as string) : first.key;
  const [tab, setTab] = useState(initialTab);
  // One remembered sub-panel per section, so hopping between sections keeps your place.
  const [subs, setSubs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of sections) init[s.key] = s.key === initialTab && s.panels.some((p) => p.key === reqSub) ? (reqSub as string) : s.panels[0]!.key;
    return init;
  });
  const section = sections.find((s) => s.key === tab) ?? first;
  const sub = subs[section.key] ?? section.panels[0]!.key;
  const panel = section.panels.find((p) => p.key === sub) ?? section.panels[0]!;

  // Keep the URL honest without a navigation (replaceState - no scroll jump, no refetch).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const url = new URL(window.location.href);
    url.searchParams.set("tab", section.key);
    if (section.panels.length > 1) url.searchParams.set("sub", panel.key); else url.searchParams.delete("sub");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [section.key, panel.key, section.panels.length]);

  const go = (key: string) => setTab(key);

  const railIndex = useMemo(() => sections.findIndex((s) => s.key === section.key), [sections, section.key]);

  // Mobile: keep the active pill / sub-tab in view when it starts off-screen.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [section.key]);
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(`[data-subtabs="${section.key}"]`);
    const active = row?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [section.key, panel.key]);

  return (
    <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* ---- Rail (desktop) / pill strip (mobile) ---- */}
      <nav aria-label="Settings sections" className="lg:sticky lg:top-6">
        {/* Mobile strip */}
        <div ref={stripRef} className="-mx-4 mb-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div role="tablist" className="inline-flex gap-1 rounded-full border border-border bg-surface p-1 shadow-sm">
            {sections.map((s) => {
              const on = s.key === section.key;
              const I = ICONS[s.icon];
              return (
                <button key={s.key} type="button" role="tab" aria-selected={on} onClick={() => go(s.key)}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors", on ? "bg-accent text-accent-ink shadow-sm" : "text-text-2 hover:bg-surface-hover hover:text-text")}>
                  <I className="size-3.5" strokeWidth={2} aria-hidden /> {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop rail */}
        <div role="tablist" aria-orientation="vertical" className="relative hidden overflow-hidden rounded-card border border-border bg-surface shadow-sm lg:block">
          {/* The sliding active marker */}
          <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-[64px] w-full bg-accent-soft/60 transition-transform duration-300 [transition-timing-function:var(--ease-out)]" style={{ transform: `translateY(${railIndex * 64}px)` }} />
          <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-[64px] w-[3px] rounded-r bg-accent transition-transform duration-300 [transition-timing-function:var(--ease-out)]" style={{ transform: `translateY(${railIndex * 64}px)` }} />
          {sections.map((s) => {
            const on = s.key === section.key;
            const I = ICONS[s.icon];
            return (
              <button key={s.key} type="button" role="tab" aria-selected={on} onClick={() => go(s.key)}
                className={cn("relative flex h-[64px] w-full items-center gap-3 px-3.5 text-left transition-colors", on ? "text-text" : "text-text-2 hover:bg-surface-hover/60 hover:text-text")}>
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors", on ? "bg-accent text-accent-ink shadow-sm" : "bg-surface-2 text-text-2")}>
                  <I className="size-[17px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-[640]">{s.label}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-3">
                    {s.status && <Chip tone={s.status.tone}>{s.status.label}</Chip>}
                    <span className="min-w-0 truncate">{s.blurb}</span>
                  </span>
                </span>
                <ChevronRight className={cn("size-4 shrink-0 transition-all", on ? "translate-x-0 text-accent opacity-100" : "-translate-x-1 opacity-0")} aria-hidden />
              </button>
            );
          })}
        </div>
      </nav>

      {/* ---- Panel ---- */}
      <div className="min-w-0">
        {sections.map((s) => {
          const I = ICONS[s.icon];
          const activeSub = subs[s.key] ?? s.panels[0]!.key;
          return (
            <section key={s.key} role="tabpanel" hidden={s.key !== section.key} className="rise space-y-4">
              {/* Section header */}
              <div className="flex flex-wrap items-start gap-3 sm:items-center">
                <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent sm:flex">
                  <I className="size-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[18px] font-[680] leading-tight text-text">{s.label}</h2>
                  <p className="mt-0.5 text-[12.5px] text-text-2">{s.blurb}</p>
                </div>
              </div>

              {/* Sub-tabs (only when a section has more than one panel) */}
              {s.panels.length > 1 && (
                <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div role="tablist" aria-label={`${s.label} panels`} data-subtabs={s.key} className="flex min-w-max gap-1 border-b border-border">
                    {s.panels.map((p) => {
                      const on = p.key === activeSub;
                      return (
                        <button key={p.key} type="button" role="tab" aria-selected={on} onClick={() => setSubs((prev) => ({ ...prev, [s.key]: p.key }))}
                          className={cn("relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors", on ? "border-accent text-accent" : "border-transparent text-text-2 hover:border-border-strong hover:text-text")}>
                          {p.label}
                          {p.badge && <Chip tone={p.badgeTone}>{p.badge}</Chip>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Panels - all mounted, the active one shown (display toggling re-runs the rise) */}
              {s.panels.map((p) => (
                <div key={p.key} role="tabpanel" hidden={p.key !== activeSub} className="rise space-y-4">
                  {p.hint && <p className="text-[12.5px] text-text-3">{p.hint}</p>}
                  {p.node}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "accent" | "warn" | "muted" }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
      tone === "accent" ? "bg-accent-soft text-accent" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-2 text-text-3")}>
      {children}
    </span>
  );
}

/** A framed panel body - the sub-tab is the title, so this carries no heading of its own. */
export function SettingsPane({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-card border border-border bg-surface p-4 shadow-sm sm:p-5", className)}>{children}</div>;
}
