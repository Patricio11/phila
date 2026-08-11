"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { za } from "@/lib/format";
import { isRemote, type AppointmentType } from "@/lib/domain/enums";
import { CalendarHeart, Video } from "lucide-react";
import type { UpcomingRow } from "@/db/queries/hub-dashboard";
import type { AppointmentView } from "@/lib/data-provider";
import { AppointmentDetail } from "@/components/calendar/appointment-detail";
import type { SchedulingOptions } from "@/components/scheduling/create-appointment-modal";
import { Card, CardHead } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Feedback #3 - "Coming up next": the practice's next sessions, worded our way.
 * Date badge · service with client · price · counsellor · time. Now filterable
 * by how the session happens (All / In person / Online / Hybrid); the list
 * scrolls inside the shared widget height. Clicking a row opens the real
 * appointment right here (batch 2m) - the same detail card the calendar shows,
 * with reschedule / cancel / join - instead of dumping the reader on the
 * calendar page to find it again.
 */
const DAY_NUM = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false });

type TypeFilter = "all" | "in_person" | "online" | "hybrid";

export function ComingUpNext({
  upcoming,
  className,
  periodLabel,
  details,
  scheduling,
}: {
  upcoming: UpcomingRow[];
  className?: string;
  periodLabel?: string;
  /** The full appointment behind each row, so a click opens it in place. */
  details?: Record<string, AppointmentView>;
  /** Batch 2v - unlocks Edit inside the opened appointment. */
  scheduling?: SchedulingOptions;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (details?.[openId] ?? null) : null;

  const counts = useMemo(() => ({
    all: upcoming.length,
    in_person: upcoming.filter((u) => u.type === "in_person").length,
    online: upcoming.filter((u) => u.type === "online").length,
    hybrid: upcoming.filter((u) => u.type === "hybrid").length,
  }), [upcoming]);

  const shown = filter === "all" ? upcoming : upcoming.filter((u) => u.type === filter);

  const CHIPS: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "in_person", label: "In person" },
    { key: "online", label: "Online" },
    { key: "hybrid", label: "Hybrid" },
  ];

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHead title="Coming up next" count={shown.length} action={periodLabel ? <span className="text-[11.5px] text-text-3">{periodLabel}</span> : undefined} />
      <div className="flex flex-wrap gap-1.5 px-[17px] pb-2.5">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={cn(
              "inline-flex h-[26px] items-center gap-1 rounded-chip border px-2 text-[11.5px] font-medium transition-colors",
              filter === c.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
            )}
          >
            {c.label}
            <span className="tabular-nums opacity-70">{counts[c.key]}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <div className="px-[17px] pb-[17px]">
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarHeart className="size-5 text-text-3" strokeWidth={1.8} aria-hidden />
              <p className="text-[12.5px] text-text-3">
                {upcoming.length === 0
                  ? `Nothing scheduled ${periodLabel ?? "yet"} - bookings appear here.`
                  : "No sessions of that type in this period."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border px-[17px] pb-[9px]">
            {shown.map((u) => {
              const d = new Date(u.startsAt);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(u.id)}
                    className="flex w-full items-center gap-3.5 py-3 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="flex w-11 shrink-0 flex-col items-center rounded-control border border-border bg-surface-2/40 py-1.5">
                      <span className="text-[16px] font-bold leading-none tabular-nums text-accent">{DAY_NUM.format(d)}</span>
                      <span className="text-[10px] font-semibold uppercase text-text-3">{MONTH.format(d)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-[600] text-text">{u.serviceName} with {u.clientName}</span>
                      <span className="mt-0.5 block text-[12px] text-text-3">
                        {u.priceCents ? `R${za(Math.round(u.priceCents / 100))} · ` : ""}{u.counsellorName} · {TIME.format(d)} · {u.durationMin} min
                      </span>
                    </span>
                    {isRemote(u.type as AppointmentType) ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info"><Video className="size-3" strokeWidth={2.2} aria-hidden /> {u.type === "hybrid" ? "Hybrid" : "Online"}</span>
                    ) : (
                      <span className="shrink-0 rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Scheduled</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AppointmentDetail
        appt={open}
        onClose={() => setOpenId(null)}
        onUpdated={() => { setOpenId(null); router.refresh(); }}
        openSessions={false}
        clientBasePath="/hub/clients"
        scheduling={scheduling}
      />
    </Card>
  );
}
