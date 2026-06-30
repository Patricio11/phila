"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * Dialog (DESIGN.md §6 Modal/Sheet)  a floating modal on desktop, a bottom
 * sheet on phones, over a scrim. Esc and scrim-click close; body scroll locks
 * while open; focus moves into the dialog. Motion is GPU-only and reduced-motion
 * aware (the entrance uses the `.rise` keyframe, which is stripped under
 * prefers-reduced-motion).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const mounted = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Keep the latest onClose without making it the focus effect's dependency.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Esc + scroll-lock + initial focus run ONLY when `open` flips  not on every
  // render. (Depending on `onClose`, which is a fresh function each parent render,
  // re-ran this on every keystroke and stole focus back to the panel  the
  // single-character defocus seen across the app's dialogs.)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Land focus on the first field if there is one, else the panel.
    const field = panelRef.current?.querySelector<HTMLElement>("input, textarea");
    (field ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "rise relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[18px] border border-border bg-surface shadow-[var(--shadow-card)] outline-none sm:max-w-lg sm:rounded-card",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16px] font-[660] tracking-[-0.01em] text-text">{title}</h2>
            {description ? <p className="mt-0.5 text-[12.5px] text-text-2">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? <div className="border-t border-border px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
