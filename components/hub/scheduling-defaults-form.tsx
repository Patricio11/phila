"use client";

import { useState, useTransition } from "react";
import { Clock, Hourglass, Save } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveSchedulingDefaults } from "@/app/hub/settings/actions";

const DURATIONS = [30, 45, 60, 90];
const INTERVALS = [0, 5, 10, 15, 20, 30];

/**
 * Scheduling defaults — the default session length and the inter-session interval
 * (buffer). The interval is a gap after each session so bookings aren't back-to-back:
 * the slot engine won't offer the next start until the interval has passed.
 */
export function SchedulingDefaultsForm({ initial }: { initial: { defaultDurationMin: number; bufferMin: number } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [duration, setDuration] = useState(initial.defaultDurationMin);
  const [buffer, setBuffer] = useState(initial.bufferMin);

  const save = () => {
    const d = Math.round(duration || 0);
    const b = Math.round(buffer || 0);
    if (d < 10) return toast({ tone: "error", title: "A session is at least 10 minutes." });
    if (b < 0 || b > 120) return toast({ tone: "error", title: "Keep the interval between 0 and 120 minutes." });
    start(async () => {
      const res = await saveSchedulingDefaults({ defaultDurationMin: d, bufferMin: b });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Scheduling saved", description: b > 0 ? `A ${b}-minute gap now sits between sessions.` : "No gap between sessions." });
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Clock className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> Default session length</Label>
          <div className="flex items-center gap-1.5">
            <Input type="number" min={10} step={5} inputMode="numeric" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-10 w-24" />
            <span className="text-[12.5px] text-text-3">min</span>
          </div>
          <div className="flex flex-wrap gap-1 pt-0.5">
            {DURATIONS.map((d) => (
              <button key={d} type="button" onClick={() => setDuration(d)} className="rounded-chip border border-border px-2 py-0.5 text-[11px] text-text-3 hover:border-accent hover:text-accent">{d}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Hourglass className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> Interval between sessions</Label>
          <div className="flex items-center gap-1.5">
            <Input type="number" min={0} step={5} inputMode="numeric" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className="h-10 w-24" />
            <span className="text-[12.5px] text-text-3">min</span>
          </div>
          <div className="flex flex-wrap gap-1 pt-0.5">
            {INTERVALS.map((b) => (
              <button key={b} type="button" onClick={() => setBuffer(b)} className="rounded-chip border border-border px-2 py-0.5 text-[11px] text-text-3 hover:border-accent hover:text-accent">{b}</button>
            ))}
          </div>
        </div>
      </div>

      <p className="rounded-control bg-surface-2/50 px-3 py-2 text-[12px] leading-relaxed text-text-2">
        The <span className="font-medium text-text">interval</span>{" "}is a gap after each session so bookings aren&apos;t back-to-back
        {buffer > 0 ? (
          <> — a session ending <span className="font-medium text-text">9:40</span> with a {buffer}-minute interval frees{" "}
            <span className="font-medium text-text">{addMinutesLabel("09:40", buffer)}</span> for the next booking.</>
        ) : <> — set to 0 for no gap.</>}
      </p>

      <Button size="sm" onClick={save} loading={pending}>
        <Save className="size-4" strokeWidth={2} aria-hidden /> Save scheduling
      </Button>
    </div>
  );
}

function addMinutesLabel(hhmm: string, add: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h! * 60 + m! + add) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
