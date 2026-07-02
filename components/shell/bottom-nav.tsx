"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, Settings } from "lucide-react";
import type { NavSection } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation (DESIGN.md §5.4)  a native-feeling floating tab bar pinned to
 * the bottom (respecting the iPhone home-indicator safe area), showing the primary
 * destinations, with a **More** (⋯) tab that slides up a sheet holding the full
 * menu. Desktop keeps the sidebar; this is `lg:hidden`.
 */
const PRIMARY = 4;

function activeHrefFor(items: { href: string }[], pathname: string): string | undefined {
  return items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function BottomNav({ sections, settingsHref }: { sections: NavSection[]; settingsHref?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const items = sections.flatMap((s) => s.items).filter((i) => i.ready ?? true);
  if (items.length < 2) return null; // e.g. the funder portal is a single surface

  const activeHref = activeHrefFor(items, pathname);
  const useMore = items.length > PRIMARY;
  const tabs = useMore ? items.slice(0, PRIMARY) : items;
  const moreActive = useMore && activeHref !== undefined && !tabs.some((t) => t.href === activeHref);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/85 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-[54px] max-w-md items-stretch justify-around px-1">
          {tabs.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-text-3 active:text-text-2",
                )}
              >
                <item.icon className={cn("size-[23px] transition-transform duration-200", active && "-translate-y-px scale-105")} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
                <span className="max-w-[64px] truncate leading-none">{item.label}</span>
              </Link>
            );
          })}
          {useMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="More"
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors",
                moreActive ? "text-accent" : "text-text-3 active:text-text-2",
              )}
            >
              <MoreHorizontal className="size-[23px]" strokeWidth={moreActive ? 2.2 : 1.9} aria-hidden />
              <span className="leading-none">More</span>
            </button>
          )}
        </div>
      </nav>

      {useMore && (
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} sections={sections} settingsHref={settingsHref} activeHref={activeHref} />
      )}
    </>
  );
}

function MoreSheet({
  open,
  onClose,
  sections,
  settingsHref,
  activeHref,
}: {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
  settingsHref?: string;
  activeHref?: string;
}) {
  // Esc closes; lock body scroll while the sheet is up (native-feeling).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More menu"
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[20px] border-t border-border bg-surface shadow-[var(--shadow-card)] transition-transform duration-300 ease-[cubic-bezier(.2,0,0,1)]",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
      >
        <div className="sticky top-0 z-10 flex justify-center bg-surface/95 pb-1.5 pt-2.5 backdrop-blur">
          <span className="h-1 w-9 rounded-full bg-border-strong" aria-hidden />
        </div>

        <div className="px-3 pt-1">
          {sections.map((section) => (
            <div key={section.label} className="mb-1.5">
              <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-3">{section.label}</div>
              {section.items.map((item) => {
                const active = item.href === activeHref;
                const ready = item.ready ?? true;
                return ready ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-control px-2.5 py-2.5 text-[14.5px] transition-colors",
                      active ? "bg-accent-soft font-medium text-accent" : "text-text-2 active:bg-surface-hover",
                    )}
                  >
                    <item.icon className="size-[19px] shrink-0" strokeWidth={1.9} aria-hidden />
                    {item.label}
                  </Link>
                ) : (
                  <span key={item.href} className="flex items-center gap-3 rounded-control px-2.5 py-2.5 text-[14.5px] text-text-3">
                    <item.icon className="size-[19px] shrink-0" strokeWidth={1.9} aria-hidden />
                    {item.label}
                    <span className="ml-auto rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
                  </span>
                );
              })}
            </div>
          ))}

          {settingsHref && (
            <div className="mt-1 border-t border-border pt-1.5">
              <Link href={settingsHref} onClick={onClose} className="flex items-center gap-3 rounded-control px-2.5 py-2.5 text-[14.5px] text-text-2 active:bg-surface-hover">
                <Settings className="size-[19px] shrink-0" strokeWidth={1.9} aria-hidden />
                Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
