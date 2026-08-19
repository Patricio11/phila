"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardCheck, MapPin, Video } from "lucide-react";
import type { ClassSessionView } from "@/db/queries/classrooms";
import { Dialog } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { scheduleClassSession, markClassAttendance } from "@/app/app/supervision/actions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * Live class meetings (batch 2b): the supervisor schedules them, everyone gets
 * the link for online ones, and the register (present/absent) is marked after -
 * kept permanently as CPD/supervision evidence.
 */
export function ClassSessions({ classId, className, members, sessions, canManage, nowISO }: {
  classId: string;
  className: string;
  members: { counsellorId: string; name: string }[];
  sessions: ClassSessionView[];
  canManage: boolean;
  nowISO: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState(60);
  const [mode, setMode] = useState<"online" | "in_person">("online");
  const [location, setLocation] = useState("");
  // Batch 2e - repeat weekly so nobody re-creates the same session every week.
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [registerFor, setRegisterFor] = useState<ClassSessionView | null>(null);
  const [marks, setMarks] = useState<Record<string, "present" | "absent">>({});

  const nowMs = new Date(nowISO).getTime();
  const upcoming = sessions.filter((s) => new Date(s.startsAt).getTime() + s.durationMin * 60_000 >= nowMs).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = sessions.filter((s) => new Date(s.startsAt).getTime() + s.durationMin * 60_000 < nowMs).slice(0, 4);

  const errors = { title: title.trim().length < 2 ? "Give the session a title." : "", date: !date ? "Pick a date." : "", time: !time ? "Pick a time." : "" };

  const schedule = () => {
    setAttempted(true);
    if (errors.title || errors.date || errors.time) return;
    start(async () => {
      const res = await scheduleClassSession({ classId, title: title.trim(), date, time, durationMin, mode, location: location.trim() || undefined, repeatWeeks: repeatOn ? repeatWeeks : 1 });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({
        tone: "success",
        title: res.count > 1 ? `${res.count} weekly sessions scheduled` : "Session scheduled",
        description: res.count > 1
          ? `Same day and time for ${res.count} weeks - the class was notified once.`
          : "The class was notified - online sessions carry the join link here.",
      });
      setOpen(false); setTitle(""); setDate(""); setAttempted(false); setRepeatOn(false); setRepeatWeeks(4);
      router.refresh();
    });
  };

  const openRegister = (s: ClassSessionView) => {
    setRegisterFor(s);
    const initial: Record<string, "present" | "absent"> = {};
    for (const m of members) initial[m.counsellorId] = s.attendance[m.counsellorId] ?? "present";
    setMarks(initial);
  };

  const saveRegister = () => {
    if (!registerFor) return;
    start(async () => {
      const res = await markClassAttendance({ sessionId: registerFor.id, marks: members.map((m) => ({ counsellorId: m.counsellorId, status: marks[m.counsellorId] ?? "present" })) });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const present = members.filter((m) => (marks[m.counsellorId] ?? "present") === "present").length;
      toast({ tone: "success", title: "Register saved", description: `${present} present · ${members.length - present} absent - kept on record.` });
      setRegisterFor(null);
      router.refresh();
    });
  };

  const registerLabel = (s: ClassSessionView) => {
    const values = Object.values(s.attendance);
    if (values.length === 0) return "register not marked";
    const present = values.filter((v) => v === "present").length;
    return `${present} present · ${values.length - present} absent`;
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Sessions</h3>
        {canManage && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <CalendarPlus className="size-3.5" strokeWidth={2} aria-hidden /> Schedule session
          </Button>
        )}
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <p className="text-[12.5px] text-text-3">No sessions yet{canManage ? " - schedule the first one." : "."}</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-control border border-accent/25 bg-accent-soft/20 px-3 py-2.5">
              {s.mode === "online" ? <Video className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden /> : <MapPin className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-text">{s.title}</span>
                <span className="block text-[11.5px] text-text-3">{when(s.startsAt)} · {s.durationMin} min{s.mode === "in_person" && s.location ? ` · ${s.location}` : ""}</span>
              </span>
              {s.mode === "online" ? (
                <Button asChild size="sm">
                  <a href={`/class-room/${s.id}`} target="_blank" rel="noopener noreferrer">
                    <Video className="size-3.5" strokeWidth={2} aria-hidden /> Join
                  </a>
                </Button>
              ) : (
                <span className="rounded-chip bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-2">In person</span>
              )}
            </li>
          ))}
          {past.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-control border border-border px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-text-2">{s.title}</span>
                <span className="block text-[11.5px] text-text-3">{when(s.startsAt)} · {registerLabel(s)}</span>
              </span>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => openRegister(s)}>
                  <ClipboardCheck className="size-3.5" strokeWidth={2} aria-hidden /> {Object.keys(s.attendance).length ? "Edit register" : "Mark register"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Schedule */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule a class session"
        description={`Everyone in ${className} is notified - online sessions get a join link right on the class page.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={schedule} loading={pending}>Schedule</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly group supervision" invalid={Boolean(attempted && errors.title)} />
            {attempted && errors.title ? <FieldError>{errors.title}</FieldError> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker value={date} onChange={setDate} min={localToday()} invalid={Boolean(attempted && errors.date)} ariaLabel="Session date" />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <TimePicker value={time} onChange={setTime} ariaLabel="Session time" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={String(durationMin)} onChange={(v) => setDurationMin(Number(v))} options={[30, 45, 60, 90, 120].map((d) => ({ value: String(d), label: `${d} minutes` }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Where</Label>
              <Select value={mode} onChange={(v) => setMode(v as "online" | "in_person")} options={[{ value: "online", label: "Online - secure video room" }, { value: "in_person", label: "In person" }]} />
            </div>
          </div>
          {mode === "in_person" && (
            <div className="space-y-1.5">
              <Label>Venue (optional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Boardroom, Soweto Vilakazi branch" />
            </div>
          )}

          {/* Repeat weekly (batch 2e) - one click books the whole run. */}
          <div className="rounded-control border border-border bg-surface p-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-[600] text-text">Repeat weekly</div>
                <p className="text-[12px] text-text-2">Book the same day and time for several weeks in one go.</p>
              </div>
              <Switch checked={repeatOn} onChange={() => setRepeatOn((v) => !v)} label="Repeat weekly" />
            </div>
            {repeatOn && (
              <div className="mt-2.5 flex items-center gap-2 border-t border-border/70 pt-2.5">
                <Label className="mb-0">For</Label>
                <div className="w-32">
                  <Select value={String(repeatWeeks)} onChange={(v) => setRepeatWeeks(Number(v))} options={[2, 4, 6, 8, 12].map((w) => ({ value: String(w), label: `${w} weeks` }))} />
                </div>
                <span className="text-[12px] text-text-3">{repeatWeeks} sessions in total.</span>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Attendance register */}
      <Dialog
        open={Boolean(registerFor)}
        onClose={() => setRegisterFor(null)}
        title={registerFor ? `Register · ${registerFor.title}` : "Register"}
        description="Mark who attended - the register stays on record (supervision/CPD evidence)."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRegisterFor(null)} disabled={pending}>Cancel</Button>
            <Button onClick={saveRegister} loading={pending}>Save register</Button>
          </div>
        }
      >
        <ul className="space-y-1.5">
          {members.map((m) => {
            const status = marks[m.counsellorId] ?? "present";
            return (
              <li key={m.counsellorId} className="flex items-center gap-2.5 rounded-control border border-border p-2.5">
                <Avatar name={m.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{m.name}</span>
                <div className="inline-flex rounded-control border border-border p-0.5">
                  {(["present", "absent"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMarks((p) => ({ ...p, [m.counsellorId]: v }))}
                      aria-pressed={status === v}
                      className={cn(
                        "h-7 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors",
                        status === v ? (v === "present" ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn") : "text-text-3 hover:text-text",
                      )}
                    >
                      {v === "present" ? "Present" : "Absent"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </div>
  );
}
