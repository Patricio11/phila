import { notFound } from "next/navigation";
import { DoorOpen, MapPin, Video } from "lucide-react";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rooms" };

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default async function CounsellorRoomsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const now = new Date().toISOString();
  const { assignments, bookings } = await provider.getCounsellorRooms(me.id, now);

  return (
    <div className="rise space-y-6">
      <PageHead title="Your rooms" summary="The rooms you're assigned to and your in-person sessions this week." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Your assignments" count={assignments.length} />
          <div className="space-y-2.5 px-[17px] pb-[17px]">
            {assignments.length === 0 ? (
              <EmptyState icon={DoorOpen} title="No room assignments" body="Your practice manager assigns rooms by day and time." />
            ) : (
              assignments.map((a, i) => (
                <div key={i} className="flex items-center gap-3 rounded-control border border-border p-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: a.colour }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-[600] text-text">{a.roomName}</div>
                    <div className="flex items-center gap-1 text-[12px] text-text-3">
                      <MapPin className="size-3.5" strokeWidth={2} aria-hidden /> {a.siteName}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[12px] text-text-2">
                    <div className="font-medium">{a.days.map((d) => DOW[d]).join(" & ")}</div>
                    <div className="text-text-3 tabular-nums">{a.start}–{a.end}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="In-person this week" count={bookings.length} />
          <div className="space-y-1.5 px-[17px] pb-[17px]">
            {bookings.length === 0 ? (
              <EmptyState icon={DoorOpen} title="No in-person sessions" body="Your in-room bookings for this week will show here." />
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-control border border-border p-3">
                  <Avatar name={b.clientName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-text">{b.clientName}</div>
                    <div className="text-[11.5px] text-text-3">{b.serviceName} · {b.roomName}</div>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-text-2">{timeOf(b.startsAt)}</span>
                  {b.type === "online" && <Video className="size-3.5 text-info" strokeWidth={2} aria-hidden />}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
