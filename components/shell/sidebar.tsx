"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import { BrandMark } from "@/components/brand/aloe-mark";
import type { NavSection } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

/**
 * The sidebar — the signature structure (DESIGN.md §5.1). 248px ↔ 72px, smooth
 * collapse. Active item gets `--accent-soft`, accent text, and a 3px accent bar
 * on the left edge. On collapse, labels and badges fade and the icon centres,
 * with the full label as a native tooltip.
 */
export function Sidebar({
  sections,
  orgName,
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  sections: NavSection[];
  orgName: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  // The active item is the longest href that matches the path (so /me/sessions
  // wins over /me, and an index route like /me isn't active on its children).
  const activeHref = sections
    .flatMap((s) => s.items)
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-3.5">
        <BrandMark size={32} />
        <span
          className={cn(
            "flex min-w-0 flex-col leading-tight transition-opacity duration-150",
            collapsed && "pointer-events-none opacity-0",
          )}
        >
          <span className="text-[15px] font-[650] tracking-[-0.01em] text-text">Phila</span>
          <span className="truncate text-[11.5px] text-text-3">{orgName}</span>
        </span>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            <p
              className={cn(
                "px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-text-3 transition-opacity duration-150",
                collapsed && "opacity-0",
              )}
            >
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                const ready = item.ready ?? false;

                const inner = (
                  <>
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <Icon className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
                    <span
                      className={cn(
                        "flex-1 truncate text-left transition-opacity duration-150",
                        collapsed && "opacity-0",
                      )}
                    >
                      {item.label}
                    </span>
                    {!ready && !collapsed && (
                      <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-3">
                        Soon
                      </span>
                    )}
                    {item.badge !== undefined && !collapsed && (
                      <span className="rounded-pill bg-accent-soft px-1.5 text-[11px] font-semibold tabular-nums text-accent">
                        {item.badge}
                      </span>
                    )}
                  </>
                );

                const base =
                  "group relative flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[13.5px] font-medium transition-colors";

                return (
                  <li key={item.href}>
                    {ready ? (
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          base,
                          active
                            ? "bg-accent-soft font-semibold text-accent"
                            : "text-text-2 hover:bg-surface-hover hover:text-text",
                          collapsed && "justify-center",
                        )}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <span
                        title={collapsed ? `${item.label} — coming soon` : undefined}
                        aria-disabled
                        className={cn(
                          base,
                          "cursor-default text-text-3/80",
                          collapsed && "justify-center",
                        )}
                      >
                        {inner}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Foot */}
      <div className="border-t border-border px-2.5 py-2.5">
        <span
          title={collapsed ? "Settings — coming soon" : undefined}
          aria-disabled
          className={cn(
            "flex h-9 cursor-default items-center gap-2.5 rounded-control px-2.5 text-[13.5px] font-medium text-text-3/80",
            collapsed && "justify-center",
          )}
        >
          <Settings className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
          <span className={cn("flex-1 transition-opacity duration-150", collapsed && "opacity-0")}>
            Settings
          </span>
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-[13.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text",
            collapsed && "justify-center",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn(
              "size-[18px] shrink-0 transition-transform duration-300",
              collapsed && "rotate-180",
            )}
            strokeWidth={1.9}
            aria-hidden
          />
          <span className={cn("flex-1 text-left transition-opacity duration-150", collapsed && "opacity-0")}>
            Collapse
          </span>
        </button>
      </div>
    </div>
  );
}
