"use client";

import { CalendarDays, CalendarPlus, Clock, MapPin, Video } from "lucide-react";
import type { AppointmentView } from "@/lib/data-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const JOIN_WINDOW_MIN = 10;

function countdownLabel(minsUntil: number, durationMin: number): string {
  if (minsUntil <= 0 && minsUntil > -durationMin) return "Happening now";
  if (minsUntil <= 0) return "";
  if (minsUntil < 60) return `in ${Math.round(minsUntil)} min`;
  if (minsUntil < 1440) return `in ${Math.round(minsUntil / 60)} hour${Math.round(minsUntil / 60) === 1 ? "" : "s"}`;
  const days = Math.round(minsUntil / 1440);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function downloadIcs(appt: AppointmentView) {
  const start = new Date(appt.startsAt);
  const end = new Date(start.getTime() + appt.durationMin * 60000);
  const z = (d: Date) => `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Phila//Counselling//EN", "BEGIN:VEVENT",
    `UID:${appt.id}@phila`,
    `DTSTAMP:${z(new Date())}`,
    `DTSTART:${z(start)}`,
    `DTEND:${z(end)}`,
    `SUMMARY:Counselling session with ${appt.counsellorName}`,
    `LOCATION:${appt.type === "online" ? "Online (join from your Phila portal)" : (appt.roomName ?? "In person")}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Counselling session in 1 hour", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "counselling-session.ics";
  a.click();
  URL.revokeObjectURL(url);
}

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
      <div className="flex items-center justify-between gap-2 border-b border-border bg-accent-soft/40 px-5 py-2.5">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-accent">Your next session</span>
        {countdownLabel(minsUntil, appt.durationMin) && (
          <span className="rounded-chip bg-surface px-2 py-0.5 text-[11px] font-semibold text-accent shadow-sm">{countdownLabel(minsUntil, appt.durationMin)}</span>
        )}
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

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {appt.type === "online" && (
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
          )}
          <Button variant="ghost" className="w-full sm:w-auto" onClick={() => downloadIcs(appt)}>
            <CalendarPlus className="size-4" strokeWidth={2} aria-hidden /> Add to calendar
          </Button>
        </div>
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
