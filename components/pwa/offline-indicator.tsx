"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloudOff, Loader2, CloudUpload, CheckCircle2, AlertTriangle } from "lucide-react";
import { offlineQueue } from "@/lib/pwa/offline-queue";
import { flushQueue, onQueueChanged } from "@/lib/pwa/queue-client";

/** Subscribe to the browser's online/offline state (no setState-in-effect). */
function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Global offline send-queue indicator. Honest by design: it shows "Offline — N
 * queued" while disconnected, "Syncing…" while replaying on reconnect, and the
 * real outcome (sent / needs attention) — never a fake "sent". Self-contained
 * (no toast dependency) so it can live at the root for every surface.
 */
export function OfflineIndicator() {
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const wasOnline = useRef(online);

  const refresh = useCallback(() => {
    void offlineQueue.pending().then(setPending);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    const r = await flushQueue();
    setSyncing(false);
    refresh();
    if (r.sent || r.conflicts || r.failed) {
      const attention = r.conflicts + r.failed;
      setFlash(
        attention > 0
          ? { tone: "warn", text: `${attention} need${attention === 1 ? "s" : ""} attention` }
          : { tone: "ok", text: `Synced ${r.sent}` },
      );
    }
  }, [refresh]);

  // Keep the pending count fresh + flush the queue when we come back online.
  useEffect(() => {
    refresh();
    const offChange = onQueueChanged(refresh);
    return offChange;
  }, [refresh]);

  useEffect(() => {
    if (online && !wasOnline.current) void sync();
    if (!online && wasOnline.current) setFlash(null);
    wasOnline.current = online;
  }, [online, sync]);

  // Auto-clear a success flash after a few seconds.
  useEffect(() => {
    if (flash?.tone !== "ok") return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const visible = !online || pending > 0 || syncing || Boolean(flash);
  if (!visible) return null;

  let icon = <CloudOff className="size-3.5" strokeWidth={2} aria-hidden />;
  let text = "You're offline";
  let cls = "border-border bg-surface text-text-2";

  if (syncing) {
    icon = <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden />;
    text = "Syncing…";
    cls = "border-info/30 bg-info-soft text-info";
  } else if (flash) {
    icon = flash.tone === "ok" ? <CheckCircle2 className="size-3.5" strokeWidth={2} aria-hidden /> : <AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden />;
    text = flash.text;
    cls = flash.tone === "ok" ? "border-accent/30 bg-accent-soft text-accent" : "border-warn/40 bg-warn-soft text-warn";
  } else if (!online && pending > 0) {
    icon = <CloudUpload className="size-3.5" strokeWidth={2} aria-hidden />;
    text = `Offline — ${pending} queued`;
    cls = "border-warn/40 bg-warn-soft text-warn";
  } else if (online && pending > 0) {
    icon = <AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden />;
    text = `${pending} need${pending === 1 ? "s" : ""} attention`;
    cls = "border-warn/40 bg-warn-soft text-warn";
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4" aria-live="polite">
      <div className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium shadow-md ${cls}`}>
        {icon}
        {text}
      </div>
    </div>
  );
}
