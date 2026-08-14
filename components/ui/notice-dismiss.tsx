"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Batch 3n - one dismiss pattern for page notices (unbilled sessions,
 * verification nudge, duplicate clients, ...). Session-scoped on purpose:
 * these banners state standing facts (money unbilled, records to merge), so
 * closing one clears it for THIS browser session and it honestly returns
 * next visit - never a permanent mute on something that still needs doing.
 */
export function useNoticeDismissed(key: string): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(`phila_notice_${key}`)) setDismissed(true);
    } catch { /* storage blocked - the notice just stays */ }
  }, [key]);
  const dismiss = () => {
    setDismissed(true);
    try { window.sessionStorage.setItem(`phila_notice_${key}`, "1"); } catch { /* ditto */ }
  };
  return [dismissed, dismiss];
}

/** The little X, styled like the 2FA banner's - warm surfaces, quiet hover. */
export function NoticeDismiss({ onDismiss, className }: { onDismiss: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Dismiss notice"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
      className={cn("grid size-6 shrink-0 place-items-center rounded-control text-text-3 transition-colors hover:bg-warn-soft hover:text-text", className)}
    >
      <X className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
