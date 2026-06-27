"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: number;
  title: string;
  detail: string;
  ago: string;
  unread: boolean;
}

const SEED: Note[] = [
  { id: 1, title: "New booking", detail: "Fatima Adams booked an assessment", ago: "12m", unread: true },
  { id: 2, title: "Note awaiting signature", detail: "Yesterday's session with Lerato", ago: "2h", unread: true },
  { id: 3, title: "Reminder sent", detail: "Tomorrow's reminders went out", ago: "5h", unread: false },
];

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(SEED);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notes.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications  ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative inline-flex size-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
      >
        <Bell className="size-[18px]" strokeWidth={1.9} aria-hidden />
        {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-warn ring-2 ring-surface" aria-hidden />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <span className="text-[13px] font-[640] text-text">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={() => setNotes((p) => p.map((n) => ({ ...n, unread: false })))} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                <Check className="size-3.5" strokeWidth={2.2} aria-hidden /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setNotes((p) => p.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.unread ? "bg-accent" : "bg-transparent")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-text">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-text-3">{n.ago}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-text-2">{n.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
