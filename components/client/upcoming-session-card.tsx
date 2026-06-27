"use client";

import { CalendarDays, Clock, MapPin, Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const JOIN_WINDOW_MIN = 10;

/** Friendly relative day + time in SAST. */
function relativeWhen(startISO: string, nowMs: number): string {
  const start = new Date(startISO);
  const time = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);

  const dayDiff = Math.round((startOfDay(start.getTime()) - startOfDay(nowMs)) / 86_400_000);
  if (dayDiff === 0) return `Today at ${time}`;
  if (dayDiff === 1) return `Tomorrow at ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const dow = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long" }).format(start);
    return `${dow} at ${time}`;
  }
  const date = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "long",
  }).format(start);
  return `${date} at ${time}`;
}

function startOfDay(ms: number): number {
  // Day boundary in SAST (UTC+2).
  const shifted = ms + 2 * 3_600_000;
  return Math.floor(shifted / 86_400_000) * 86_400_000 - 2 * 3_600_000;
}

export function UpcomingSessionCard({
  appt,
  nowISO,
}: {
  appt: AppointmentView;
  nowISO: string;
}) {
  const { toast } = useToast();
  const nowMs = new Date(nowISO).getTime();
  const startMs = new Date(appt.startsAt).getTime();
  const minsUntil = (startMs - nowMs) / 60_000;
  const joinable = appt.type === "online" && minsUntil <= JOIN_WINDOW_MIN && minsUntil > -appt.durationMin;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      <div className="border-b border-border bg-accent-soft/40 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-accent">
        Your next session
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Avatar name={appt.counsellorName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-[640] text-text">{appt.counsellorName}</div>
            <div className="text-[13px] text-text-2">{appt.serviceName}</div>
          </div>
          {appt.type === "online" ? (
            <span className="inline-flex items-center gap-1 rounded-chip bg-info-soft px-2 py-1 text-[11.5px] font-medium text-info">
              <Video className="size-3.5" strokeWidth={2} aria-hidden /> Online
            </span>
          ) : null}
        </div>

        <div className="mt-4 space-y-2 text-[13.5px]">
          <Row icon={<CalendarDays className="size-4" />} text={relativeWhen(appt.startsAt, nowMs)} />
          <Row icon={<Clock className="size-4" />} text={`${appt.durationMin} minutes`} />
          <Row
            icon={appt.type === "online" ? <Video className="size-4" /> : <MapPin className="size-4" />}
            text={appt.type === "online" ? "Secure video  join from here" : (appt.roomName ?? "In person")}
          />
        </div>

        {appt.type === "online" && (
          <div className="mt-5">
            <Button
              className="w-full"
              disabled={!joinable}
              onClick={() =>
                toast({
                  tone: "default",
                  title: "The session room opens here",
                  description: "Your counsellor will start it  you'll join right from this page.",
                })
              }
            >
              <Video className="size-4" strokeWidth={2} aria-hidden />
              {joinable ? "Join session" : "Join opens 10 minutes before"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-text-2">
      <span className="text-text-3" aria-hidden>
        {icon}
      </span>
      {text}
    </div>
  );
}
