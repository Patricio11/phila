"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full page (batch 4i) - a working surface that takes the whole viewport. The
 * app shell (sidebar, top bar, mobile tab bar) is simply covered: z-70 sits
 * above the shell's nav (40) and sheet (50) and below dialogs (80) and toasts
 * (100), so a modal opened from inside still shows on top and toasts still
 * land. Body scroll locks while open; Esc or the X closes; on close the shell
 * is exactly where it was. Portalled to <body>, so any component can grow into
 * it without caring where it sits in the tree.
 */
export function FullPage({
  open, title, subtitle, icon: Icon, actions, onClose, children, padded = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Extra toolbar controls (left of the close button). */
  actions?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Pad + scroll the content area (calendar / documents); off for surfaces that manage their own scroll (chat). */
  padded?: boolean;
}) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute("data-fullpage", "1");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.removeAttribute("data-fullpage");
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return <>{children}</>;

  return createPortal(
    <div className="rise fixed inset-0 z-[70] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={`${title} - full page`} data-testid="full-page">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-surface px-3 shadow-sm sm:px-4">
        {Icon && <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon className="size-4" strokeWidth={2} aria-hidden /></span>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-[650] leading-tight text-text">{title}</div>
          {subtitle && <div className="truncate text-[11px] leading-tight text-text-3">{subtitle}</div>}
        </div>
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit full page"
          title="Exit full page (Esc)"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Minimize2 className="size-3.5" strokeWidth={2} aria-hidden /> <span className="hidden sm:inline">Exit full page</span><X className="size-4 sm:hidden" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className={cn("min-h-0 flex-1", padded ? "overflow-y-auto p-3 sm:p-4" : "flex flex-col overflow-hidden")}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** The toggle that surfaces on a component's own toolbar. */
export function FullPageToggle({ full, onToggle, className, label = "Full page" }: { full: boolean; onToggle: () => void; className?: string; label?: string }) {
  const Icon = full ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={full ? "Exit full page" : label}
      title={full ? "Exit full page (Esc)" : label}
      aria-pressed={full}
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-text-2 transition-colors hover:bg-surface-hover hover:text-text", full && "bg-accent-soft text-accent", className)}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
