"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import type { NotificationItem } from "@/db/queries/notifications";
import { fetchNotifications, markAllNotificationsRead } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Load on mount + poll gently so the bell stays live without a socket. The loader
  // is deferred (timer) so no state is set synchronously during the effect.
  useEffect(() => {
    let live = true;
    const run = async () => {
      const res = await fetchNotifications();
      if (!live) return;
      setNotes(res.items);
      setUnread(res.unread);
    };
    const t0 = setTimeout(run, 0);
    const t = setInterval(run, 60_000);
    return () => { live = false; clearTimeout(t0); clearInterval(t); };
  }, []);

  // Close on outside click / Escape (no setState in the effect body itself).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Opening the bell marks everything read (optimistic + persisted)  in the handler.
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setNotes((p) => p.map((n) => ({ ...n, unread: false })));
      void markAllNotificationsRead();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications  ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative inline-flex size-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
      >
        <Bell className="size-[18px]" strokeWidth={1.9} aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex min-w-[15px] items-center justify-center rounded-full bg-warn px-1 text-[9px] font-bold leading-[15px] text-white ring-2 ring-surface" aria-hidden>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <span className="text-[13px] font-[640] text-text">Notifications</span>
          </div>
          {notes.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
              <BellOff className="size-5 text-text-3" strokeWidth={1.8} aria-hidden />
              <span className="text-[12.5px] text-text-3">You&apos;re all caught up.</span>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {notes.map((n) => {
                const inner = (
                  <>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.unread ? "bg-accent" : "bg-transparent")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-text">{n.title}</span>
                        <span className="shrink-0 text-[11px] text-text-3">{ago(n.createdAt)}</span>
                      </span>
                      {n.body && <span className="mt-0.5 block text-[12px] leading-snug text-text-2">{n.body}</span>}
                    </span>
                  </>
                );
                const cls = "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover";
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} className={cls} onClick={() => setOpen(false)}>{inner}</Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
