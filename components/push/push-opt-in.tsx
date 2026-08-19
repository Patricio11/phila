"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getPushState, savePushSubscription, removePushSubscription, sendTestPush } from "@/lib/push/actions";
import { currentSubscription, pushPermission, pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push/client";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "phila.push.dismissed_until";

/**
 * Batch 4m - web push, asked for in context and never nagging.
 *
 *  - `banner`: lives at the top of Messages. Shows ONLY when Phila has push
 *    switched on, this browser can do push, permission hasn't been decided,
 *    and the person hasn't said "not now" in the last 14 days. One line, the
 *    frequency promise in the copy, two buttons.
 *  - `row`: a settings row - "Notifications on this device" on / off + a
 *    "Send me a test" that proves the lane end to end.
 *
 * Every state is honest: unsupported browser, blocked permission, push not
 * switched on for Phila, subscribed elsewhere.
 */
export function PushOptIn({ variant = "banner", className }: { variant?: "banner" | "row"; className?: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<{ available: boolean; publicKey: string | null; devices: number } | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribedHere, setSubscribedHere] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [busy, start] = useTransition();
  const [testing, startTest] = useTransition();

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = pushPermission();
      const s = await getPushState().catch(() => null);
      const sub = await currentSubscription().catch(() => null);
      const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (!alive) return;
      setPerm(p);
      setState(s);
      setSubscribedHere(Boolean(sub));
      setDismissed(until > Date.now());
    })();
    return () => { alive = false; };
  }, []);

  const turnOn = () => start(async () => {
    if (!state?.publicKey) return;
    const res = await subscribeToPush(state.publicKey);
    if (!res.ok) {
      setPerm(pushPermission());
      toast({
        tone: "error",
        title: res.reason === "denied" ? "Notifications are blocked" : res.reason === "unsupported" ? "This browser can't do notifications" : "Couldn't turn notifications on",
        description: res.reason === "denied" ? "Allow notifications for Phila in your browser's site settings, then try again." : undefined,
      });
      return;
    }
    const saved = await savePushSubscription({ ...res.sub, userAgent: navigator.userAgent.slice(0, 300) });
    if (!saved.ok) { toast({ tone: "error", title: saved.error }); return; }
    setSubscribedHere(true);
    setPerm("granted");
    setState((p) => (p ? { ...p, devices: p.devices + 1 } : p));
    toast({ tone: "success", title: "Notifications on", description: "You'll get a nudge on this device when someone messages you and you're away - never the message itself." });
  });

  const turnOff = () => start(async () => {
    const endpoint = await unsubscribeFromPush();
    if (endpoint) await removePushSubscription({ endpoint });
    setSubscribedHere(false);
    setState((p) => (p ? { ...p, devices: Math.max(0, p.devices - 1) } : p));
    toast({ tone: "default", title: "Notifications off on this device" });
  });

  const notNow = () => { localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 86_400_000)); setDismissed(true); };

  const test = () => startTest(async () => {
    const res = await sendTestPush();
    toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Test sent" : "Couldn't send a test", description: res.ok ? "It should appear on this device in a moment." : res.error });
  });

  if (variant === "banner") {
    if (!state?.available || dismissed || subscribedHere || perm !== "default" || !pushSupported()) return null;
    return (
      <div className={cn("flex items-center gap-2.5 rounded-card border border-accent/25 bg-accent-soft/30 px-3 py-2", className)} data-testid="push-banner" role="status">
        <BellRing className="size-4 shrink-0 text-accent" strokeWidth={2.2} aria-hidden />
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-text-2">
          <span className="font-[640] text-text">Get a nudge when someone messages you</span> - only while you&apos;re away, one per conversation, never the message itself.
        </p>
        <Button size="sm" variant="mini-solid" onClick={turnOn} loading={busy}>Turn on</Button>
        <button type="button" onClick={notNow} className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-text-3 hover:bg-surface-hover hover:text-text" aria-label="Not now"><X className="size-3.5" strokeWidth={2.2} aria-hidden /></button>
      </div>
    );
  }

  // row
  const supported = pushSupported();
  const blocked = perm === "denied";
  const line = !state
    ? "checking…"
    : !state.available
      ? "Not switched on for Phila yet (Phila admin → Integrations → Web push)."
      : !supported
        ? "This browser can't show notifications."
        : blocked
          ? "Blocked in this browser - allow notifications for Phila in its site settings."
          : subscribedHere
            ? `On. A nudge when someone messages you and you're away - never the message itself.${state.devices > 1 ? ` ${state.devices} devices in total.` : ""}`
            : `Off.${state.devices > 0 ? ` On for ${state.devices} other device${state.devices === 1 ? "" : "s"}.` : ""}`;
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface px-3 py-2.5", className)} data-testid="push-row">
      <BellRing className={cn("size-4", subscribedHere ? "text-accent" : "text-text-2")} strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-text">Notifications on this device</div>
        <div className="text-[11px] text-text-3">{line}</div>
      </div>
      {state?.available && supported && !blocked && (
        subscribedHere ? (
          <>
            <Button size="sm" variant="ghost" onClick={test} loading={testing}>Send me a test</Button>
            <Button size="sm" variant="ghost" onClick={turnOff} loading={busy}>Turn off</Button>
          </>
        ) : (
          <Button size="sm" onClick={turnOn} loading={busy}>Turn on</Button>
        )
      )}
    </div>
  );
}
