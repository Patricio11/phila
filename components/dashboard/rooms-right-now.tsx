import Link from "next/link";
import { ChevronRight, DoorOpen } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import type { RoomNow } from "@/db/queries/room-assignments";
import { cn } from "@/lib/utils";

function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Feedback #8, redesigned in batch 3m - room pressure at a glance, promoted to
 * a main dashboard slot. A segmented occupancy strip up top (one segment per
 * room, lit while a session is in it), then each room as a calm row: pulse +
 * room colour, name, and an honest status chip - who's in it and until when,
 * or when it's next booked.
 */
export function RoomsRightNow({ rooms, className }: { rooms: RoomNow[]; className?: string }) {
  const active = rooms.filter((r) => r.status === "active");
  if (active.length === 0) return null;
  const busy = active.filter((r) => r.busy).length;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHead
        title={<span className="flex items-center gap-2"><DoorOpen className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Rooms right now</span>}
        action={
          <span className="flex items-center gap-3">
            <span className="text-[12px] text-text-2"><span className="font-semibold tabular-nums text-text">{busy}</span> of {active.length} in use</span>
            <Link href="/hub/rooms" className="group inline-flex items-center gap-0.5 text-[12px] font-medium text-accent hover:underline">
              View all
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
            </Link>
          </span>
        }
      />

      {/* The occupancy strip - one segment per room, lit while in session. */}
      <div className="flex gap-1 px-[17px] pb-3" aria-hidden>
        {active.map((r) => (
          <span
            key={r.id}
            title={r.name}
            className={cn("h-1.5 flex-1 rounded-full transition-opacity", r.busy ? "opacity-100" : "opacity-25")}
            style={{ backgroundColor: r.colour }}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-[17px] pb-[17px]">
        {active.map((r) => (
          <Link
            key={r.id}
            href={`/hub/rooms/${r.id}`}
            className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-hover"
          >
            <span className="relative flex size-2 shrink-0" aria-hidden>
              {r.busy && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />}
              <span className={cn("relative inline-flex size-2 rounded-full", r.busy ? "bg-accent" : "bg-border-strong")} />
            </span>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.colour }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-text">{r.name}</span>
              {r.busy && <span className="block truncate text-[11.5px] text-text-3">{r.busy.counsellorName}</span>}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-chip px-2 py-0.5 text-[11.5px] font-medium tabular-nums",
                r.busy ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3",
              )}
            >
              {r.busy ? `In session · until ${hhmm(r.busy.until)}` : r.next ? `Free · next ${hhmm(r.next.startsAt)}` : "Free today"}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
