"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateAppointmentModal, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";

export function CreateAppointmentButton({
  options,
  label = "New appointment",
  variant = "primary",
  hotkey = false,
}: {
  options: SchedulingOptions;
  label?: string;
  variant?: "primary" | "ghost";
  /** Wire a global ⌘K / Ctrl-K to open the modal (use on one primary surface only). */
  hotkey?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Computed once; the label may differ between server ("Ctrl") and a Mac client
  // ("⌘"), so the <kbd> suppresses the hydration mismatch on that text.
  const [mod] = useState(() => (typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform) ? "⌘" : "Ctrl"));

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Don't hijack when the user is typing in a field.
        const el = document.activeElement;
        const typing = el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
        if (typing) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={2.2} aria-hidden />
        {label}
        {hotkey && (
          <kbd suppressHydrationWarning className="ml-1.5 hidden rounded border border-current/25 px-1.5 py-0.5 text-[10px] font-medium leading-none opacity-70 sm:inline-block">{mod === "⌘" ? "⌘K" : "Ctrl K"}</kbd>
        )}
      </Button>
      <CreateAppointmentModal open={open} onClose={() => setOpen(false)} options={options} />
    </>
  );
}
