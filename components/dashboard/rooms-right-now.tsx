import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import type { RoomNow } from "@/db/queries/room-assignments";
import { cn } from "@/lib/utils";

function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Feedback #8 — room pressure at a glance, on the dashboard. Green pulse =
 * a session is happening in that room right now.
 */
export function RoomsRightNow({ rooms }: { rooms: RoomNow[] }) {
  const active = rooms.filter((r) => r.status === "active");
  if (active.length === 0) return null;
  const busy = active.filter((r) => r.busy).length;

  return (
    <Card>
      <CardHead
        title={<span className="flex items-center gap-2"><DoorOpen className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Rooms right now</span>}
        action={<span className="text-[12px] text-text-2"><span className="font-semibold tabular-nums text-text">{busy}</span> of {active.length} in use</span>}
      />
      <div className="space-y-2 px-[17px] pb-[17px]">
        {active.map((r) => (
          <Link key={r.id} href={`/hub/rooms/${r.id}`} className="flex items-center gap-2.5 rounded-control px-1.5 py-1 transition-colors hover:bg-surface-hover">
            <span className="relative flex size-2 shrink-0" aria-hidden>
              {r.busy && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />}
              <span className={cn("relative inline-flex size-2 rounded-full", r.busy ? "bg-accent" : "bg-border-strong")} />
            </span>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.colour }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{r.name}</span>
            <span className="shrink-0 text-[12px] text-text-3">
              {r.busy
                ? `${r.busy.counsellorName.split(" ")[0]} · until ${hhmm(r.busy.until)}`
                : r.next
                  ? `free · next ${hhmm(r.next.startsAt)}`
                  : "free"}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
