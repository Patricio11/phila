"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, Settings, type LucideIcon } from "lucide-react";
import type { NavSection } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

/** Overshoot easing  a subtle spring for the active-tab pop. */
const SPRING = "ease-[cubic-bezier(.34,1.56,.64,1)]";

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
      {/* A floating, glassy, rounded pill  not edge-to-edge (DESIGN.md §5.4). */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        <nav className="pointer-events-auto flex h-[58px] w-full max-w-[440px] items-stretch justify-around gap-0.5 rounded-[24px] border border-border/70 bg-surface/75 px-1.5 shadow-[0_12px_34px_-10px_rgba(16,24,20,0.4)] backdrop-blur-xl">
          {tabs.map((item) => (
            <Tab key={item.href} href={item.href} icon={item.icon} label={item.label} active={item.href === activeHref} />
          ))}
          {useMore && <Tab icon={MoreHorizontal} label="More" active={moreActive} onClick={() => setMoreOpen(true)} />}
        </nav>
      </div>

      {useMore && (
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} sections={sections} settingsHref={settingsHref} activeHref={activeHref} />
      )}
    </>
  );
}

/** One tab  a Link (destination) or a button (More). The active state pops a
 *  soft accent pill behind the icon with a spring, and the icon lifts + tints. */
function Tab({ href, onClick, icon: Icon, label, active }: { href?: string; onClick?: () => void; icon: LucideIcon; label: string; active: boolean }) {
  const inner = (
    <>
      <span className="relative flex size-7 items-center justify-center">
        <span
          aria-hidden
          className={cn("absolute -inset-1 rounded-full bg-accent-soft transition-[transform,opacity] duration-300", SPRING, active ? "scale-100 opacity-100" : "scale-0 opacity-0")}
        />
        <Icon className={cn("relative size-[21px] transition-[transform,color] duration-300", SPRING, active ? "scale-110 text-accent" : "text-text-3")} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
      </span>
      <span className={cn("max-w-[68px] truncate text-[9.5px] font-medium leading-none transition-colors", active ? "text-accent" : "text-text-3")}>{label}</span>
    </>
  );
  const cls = "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-transform duration-150 active:scale-90";
  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>{inner}</button>
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
  // Swipe-down-to-dismiss: drag the handle; release past ~90px closes, else snaps back.
  const [dragY, setDragY] = useState(0); // reset by onDragEnd; only non-zero mid-drag
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

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

  const onDragStart = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onDragEnd = (e: React.PointerEvent) => {
    setDragging(false);
    if (e.clientY - startY.current > 90) onClose(); // measure from the actual release
    setDragY(0);
  };

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        style={{ opacity: open ? Math.max(0, 1 - dragY / 400) : 0 }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More menu"
        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[20px] border-t border-border bg-surface shadow-[var(--shadow-card)] ease-[cubic-bezier(.2,0,0,1)]"
        style={{
          transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging ? "none" : "transform 300ms cubic-bezier(.2,0,0,1)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
        }}
      >
        <div
          className="sticky top-0 z-10 flex touch-none justify-center bg-surface/95 pb-1.5 pt-2.5 backdrop-blur"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-border-strong" aria-hidden />
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
