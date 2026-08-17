"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PhoneCall, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getCallPanel, startClientCall, type CallPanelState } from "@/app/app/voice/actions";
import { cn } from "@/lib/utils";

/**
 * Phase 33.7 - the in-session VoicePhila panel. One tap bridges the
 * counsellor and client on the shared masked number; the panel shows the
 * attempt in flight, every earlier attempt, and the running system-measured
 * total. Dormant: renders nothing while the platform voice rail is off. A
 * blocked state names its reason honestly (no number / no minutes) - the
 * button never places a broken call.
 */

const STATUS_LABEL: Record<string, string> = {
  initiated: "Dialling the counsellor…",
  ringing: "Ringing…",
  answered: "Connected - the call is live",
  completed: "Completed",
  failed: "Failed",
  no_answer: "No answer",
  busy: "Busy",
  canceled: "Cancelled",
};

function sastTime(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function CallPanel({ appointmentId }: { appointmentId: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<CallPanelState | null>(null);
  const [placing, startPlacing] = useTransition();
  const stateRef = useRef<CallPanelState | null>(null);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    const res = await getCallPanel({ appointmentId });
    if (res.ok) setState(res.state);
  }, [appointmentId]);

  useEffect(() => {
    setState(null);
    void refresh();
  }, [refresh]);

  // While an attempt is in flight the webhook drives the truth - poll it in.
  useEffect(() => {
    if (!state?.activeLegId) return;
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [state?.activeLegId, refresh]);

  if (!state || !state.railOn) return null;

  const call = () =>
    startPlacing(async () => {
      const res = await startClientCall({ appointmentId });
      if (!res.ok) {
        toast({ tone: "error", title: "Call not placed", description: res.error });
        void refresh();
        return;
      }
      setState(res.state);
      toast({ tone: "success", title: "Calling…", description: "Your phone rings first; answer it and we dial the client." });
    });

  const active = state.legs.find((l) => l.id === state.activeLegId) ?? null;
  const attempts = state.legs.filter((l) => l.id !== state.activeLegId);
  const redial = state.legs.length > 0;

  return (
    <div className="space-y-2.5 rounded-card border border-border bg-surface-2/40 p-3" data-testid="call-panel">
      <div className="flex flex-wrap items-center gap-2">
        <PhoneCall className={cn("size-4 shrink-0", active ? "text-accent" : "text-text-3")} strokeWidth={2} aria-hidden />
        {active ? (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-medium text-text">
            <span className={cn("size-2 shrink-0 rounded-full", active.status === "answered" ? "animate-pulse bg-accent" : "bg-warn")} aria-hidden />
            {STATUS_LABEL[active.status] ?? active.status}
          </span>
        ) : (
          <span className="min-w-0 flex-1 text-[12.5px] text-text-2">
            {state.blocked ?? `Phone the client on the practice number - ${state.balanceMin.toLocaleString("en-ZA")} min available.`}
          </span>
        )}
        {!active && (
          <Button size="sm" variant={redial ? "ghost" : "primary"} onClick={call} loading={placing} disabled={Boolean(state.blocked)}>
            <PhoneCall className="size-3.5" strokeWidth={2} aria-hidden /> {redial ? "Call again" : "Call client"}
          </Button>
        )}
      </div>

      {(attempts.length > 0 || state.totalSec > 0) && (
        <div className="space-y-1 border-t border-border pt-2">
          {attempts.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-[12px] text-text-2">
              {l.status === "completed"
                ? <PhoneCall className="size-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                : <PhoneOff className="size-3.5 shrink-0 text-text-3" strokeWidth={2} aria-hidden />}
              <span className="tabular-nums text-text-3">{sastTime(l.startedAt)}</span>
              <span>{STATUS_LABEL[l.status] ?? l.status}</span>
              {l.status === "completed" && (
                <span className="ml-auto tabular-nums">{fmtSec(l.durationSec)} · billed {l.billedMin} min</span>
              )}
            </div>
          ))}
          {state.totalSec > 0 && (
            <div className="flex items-center justify-between pt-0.5 text-[12px] font-semibold text-text">
              <span>Total connected</span>
              <span className="tabular-nums">{fmtSec(state.totalSec)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
