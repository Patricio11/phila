"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { extendSeries } from "@/app/app/appointments/actions";
import { Card, CardBody, CardHead } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface EndingSeries {
  seriesId: string;
  clientName: string;
  /** Scheduled sessions still to come (0 = the last one already happened). */
  remaining: number;
  lastStartsAt: string; // ISO
}

const WEEK_OPTIONS = [2, 4, 6, 12];

const SAST_DAY = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long" });
const SAST_DATE = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" });
const SAST_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * "We need more time" - the one place a counsellor adds sessions: extending an
 * existing client's recurring series that is about to run out. New bookings live
 * with the practice; continuity of care lives here.
 */
export function SeriesEndingSoon({ items }: { items: EndingSeries[] }) {
  return (
    <Card>
      <CardHead title="Sessions running out" count={items.length} />
      <CardBody className="space-y-2.5 pt-0">
        <p className="text-[12.5px] leading-relaxed text-text-2">
          These weekly series are nearly done. If a client needs more time, add sessions here  they continue the
          same day, time and room, and the client is told.
        </p>
        {items.map((s) => <Row key={s.seriesId} item={s} />)}
      </CardBody>
    </Card>
  );
}

function Row({ item }: { item: EndingSeries }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [pending, start] = useTransition();

  const last = new Date(item.lastStartsAt);
  const slotLabel = `${SAST_DAY.format(last)}s ${SAST_TIME.format(last)}`;
  const endLabel = SAST_DATE.format(last);
  const statusLabel =
    item.remaining === 0
      ? `last session was ${endLabel}`
      : `${item.remaining} session${item.remaining === 1 ? "" : "s"} left · ends ${endLabel}`;

  const confirm = () => {
    start(async () => {
      const res = await extendSeries({ seriesId: item.seriesId, addCount: weeks });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({
        tone: "success",
        title: `${res.added} session${res.added === 1 ? "" : "s"} added for ${item.clientName}`,
        description: `The series now runs to ${SAST_DATE.format(new Date(res.lastDate))}. ${item.clientName.split(" ")[0]} has been notified.`,
      });
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="rounded-control border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-chip bg-warn-soft text-warn">
          <CalendarPlus className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-[600] text-text">{item.clientName}</div>
          <div className="text-[12px] text-text-2">{slotLabel} · {statusLabel}</div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-[12.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
          >
            <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden /> Add sessions
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2.5">
          <span className="text-[12px] font-medium text-text-2">How many more weeks?</span>
          <div className="flex gap-1.5">
            {WEEK_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeeks(w)}
                aria-pressed={weeks === w}
                className={cn(
                  "inline-flex h-7 min-w-9 items-center justify-center gap-1 rounded-chip border px-2 text-[12px] font-medium transition-colors",
                  weeks === w ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
                )}
              >
                {weeks === w && <Check className="size-3" strokeWidth={2.6} aria-hidden />}{w}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="h-8 rounded-control px-2.5 text-[12.5px] font-medium text-text-3 transition-colors hover:text-text">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-[12.5px] font-medium text-accent-ink transition-[filter] hover:brightness-95 disabled:opacity-60"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Add {weeks} session{weeks === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
