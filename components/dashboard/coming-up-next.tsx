import Link from "next/link";
import { za } from "@/lib/format";
import { isRemote, type AppointmentType } from "@/lib/domain/enums";
import { CalendarHeart, Video } from "lucide-react";
import type { UpcomingRow } from "@/db/queries/hub-dashboard";

/**
 * Feedback #3 - "Coming up next": the practice's next five sessions, worded
 * our way. Date badge · service with client · price · counsellor · time.
 */
const DAY_NUM = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false });

export function ComingUpNext({ upcoming }: { upcoming: UpcomingRow[] }) {
  if (upcoming.length === 0) {
    return (
      <div className="px-[17px] pb-[17px]">
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CalendarHeart className="size-5 text-text-3" strokeWidth={1.8} aria-hidden />
          <p className="text-[12.5px] text-text-3">Nothing scheduled yet - new bookings appear here.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border px-[17px] pb-[9px]">
      {upcoming.map((u) => {
        const d = new Date(u.startsAt);
        return (
          <li key={u.id}>
            <Link href={`/hub/appointments`} className="flex items-center gap-3.5 py-3 transition-colors hover:bg-surface-hover">
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
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
