"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KebabItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

/**
 * The three-dots menu (batch 2k) - per-row actions without the selection dance.
 * Portaled to <body> (rise animations create stacking contexts a nested z-index
 * can't cross), anchored to the trigger's rect; Esc / click-outside closes.
 */
export function KebabMenu({ items, label = "More options", className }: { items: KebabItem[]; label?: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<{ top: number; right: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text", className)}
      >
        <MoreVertical className="size-[17px]" strokeWidth={1.9} aria-hidden />
      </button>
      {open && anchor && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: anchor.top, right: anchor.right, zIndex: 90 }}
          className="pop w-48 rounded-card border border-border bg-surface p-1.5 shadow-[var(--shadow-card)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] transition-colors",
                item.danger ? "text-danger hover:bg-danger-soft" : "text-text-2 hover:bg-surface-hover hover:text-text",
              )}
            >
              {item.icon && <item.icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
