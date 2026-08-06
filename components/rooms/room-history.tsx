"use client";

import { useEffect, useState } from "react";
import { History, Users, Video } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar } from "@/components/ui/avatar";
import { getRoomHistory } from "@/app/hub/rooms/actions";
import type { RoomHistoryDay } from "@/db/queries/room-assignments";

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function hours(mins: number): string {
  return `${Math.round((mins / 60) * 10) / 10}h`;
}

/**
 * Feedback #8 - "who was in this room?" Pick any date and see the permanent
 * record: which counsellors held sessions here, how many, for how long. Derived
 * from the appointments record, so it's complete retroactively and forever.
 */
export function RoomHistory({ roomId, today }: { roomId: string; today: string }) {
  const [date, setDate] = useState(today);
  const [data, setData] = useState<RoomHistoryDay | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getRoomHistory({ roomId, date })
      .then((res) => { if (alive && res.ok) setData(res.history); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [roomId, date]);

  return (
    <Card>
      <CardHead
        title={<span className="flex items-center gap-2"><History className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Who was in this room</span>}
      />
      <div className="space-y-3 px-[17px] pb-[17px]">
        <DatePicker value={date} onChange={setDate} max={today} ariaLabel="History date" />

        {loading && !data ? (
          <p className="py-2 text-[12.5px] text-text-3">Loading…</p>
        ) : !data || data.sessions.length === 0 ? (
          <p className="py-1 text-[12.5px] text-text-3">No sessions in this room on that day.</p>
        ) : (
          <>
            <p className="text-[12.5px] font-medium text-text">
              {data.counsellors.length} counsellor{data.counsellors.length === 1 ? "" : "s"} · {data.sessions.length} session{data.sessions.length === 1 ? "" : "s"} · {hours(data.totalMinutes)}
            </p>

            <ul className="space-y-1.5">
              {data.counsellors.map((c) => (
                <li key={c.name} className="flex items-center gap-2 text-[12.5px]">
                  <Avatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium text-text">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-text-3">{c.sessions} · {hours(c.minutes)}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-2.5">
              <ul className="space-y-1">
                {data.sessions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px]">
                    <span className="w-11 shrink-0 tabular-nums text-text-3">{timeOf(s.startsAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-text-2">{s.clientName}</span>
                    <span className="shrink-0 text-text-3">{s.counsellorName.split(" ")[0]}</span>
                    {s.type === "hybrid" ? <Video className="size-3 shrink-0 text-info" strokeWidth={2} aria-hidden /> : null}
                    {s.state === "no_show" ? <Users className="size-3 shrink-0 text-warn" strokeWidth={2} aria-hidden /> : null}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
