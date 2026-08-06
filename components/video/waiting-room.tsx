"use client";

import { useEffect, useState } from "react";
import { Clock, Video } from "lucide-react";

/**
 * The waiting room (feedback #10). A genuine join link clicked before the room
 * opens lands here - session details, a live countdown, and an automatic entry
 * the moment the window opens (the page reloads; the server then renders the
 * pre-join). Calm by design: arriving early should feel right, not like an error.
 */
export function WaitingRoom({ orgName, serviceName, hostName, startsAtISO, startsAtLabel, opensEarlyMin }: {
  orgName: string;
  serviceName: string;
  hostName: string;
  startsAtISO: string;
  startsAtLabel: string;
  opensEarlyMin: number;
}) {
  const opensAt = new Date(startsAtISO).getTime() - opensEarlyMin * 60_000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= opensAt) window.location.reload(); // the server lets you into the pre-join
    }, 1_000);
    return () => clearInterval(id);
  }, [opensAt]);

  const left = Math.max(0, opensAt - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const mins = Math.floor((left % 3_600_000) / 60_000);
  const secs = Math.floor((left % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md space-y-5 rounded-card border border-border bg-surface p-7 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Video className="size-6" strokeWidth={2} aria-hidden />
        </div>
        <div>
          <h1 className="text-[19px] font-[680] tracking-[-0.01em] text-text">You&apos;re in the right place</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">
            Your {serviceName.toLowerCase()} with {hostName} at {orgName} is booked for
            <span className="font-medium text-text"> {startsAtLabel}</span>.
          </p>
        </div>

        <div className="rounded-control bg-surface-2/70 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-3">The room opens in</div>
          <div className="mt-1.5 text-[30px] font-bold tabular-nums tracking-tight text-text" aria-live="polite">
            {days > 0 ? `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}` : `${pad(hours)}:${pad(mins)}:${pad(secs)}`}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-text-3">
            <Clock className="size-3.5" strokeWidth={2} aria-hidden /> Doors open {opensEarlyMin} minutes before your session
          </div>
        </div>

        <p className="text-[12.5px] leading-relaxed text-text-3">
          You can keep this page open - you&apos;ll be let in automatically. Or come back closer to the
          time using the same link.
        </p>
      </div>
    </div>
  );
}
