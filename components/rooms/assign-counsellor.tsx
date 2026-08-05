"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { Label, FieldError } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { saveRoomAssignment, removeRoomAssignment } from "@/app/hub/rooms/actions";
import { cn } from "@/lib/utils";

const DAYS: { n: number; label: string }[] = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" }, { n: 4, label: "Thu" },
  { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 7, label: "Sun" },
];

/**
 * Feedback #8 — the assignment flow is real: it persists, warns honestly (the
 * counsellor's availability, their other rooms, this room's other claims), and
 * a second confirm saves anyway when the org knows better.
 */
export function AssignCounsellorButton({ roomId, roomName, counsellors }: { roomId: string; roomName: string; counsellors: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [counsellorId, setCounsellorId] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([1, 3]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("13:00");

  const errors = {
    counsellor: !counsellorId ? "Pick a counsellor." : "",
    days: days.length === 0 ? "Pick at least one day." : "",
    time: endTime <= startTime ? "End must be after start." : "",
  };

  const toggleDay = (n: number) => {
    setWarnings([]);
    setDays((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n].sort()));
  };

  const reset = () => {
    setOpen(false);
    setWarnings([]);
    setAttempted(false);
  };

  const submit = (force: boolean) => {
    setAttempted(true);
    if (errors.counsellor || errors.days || errors.time) return;
    start(async () => {
      const res = await saveRoomAssignment({ roomId, counsellorId: counsellorId!, days, start: startTime, end: endTime, force });
      if (!res.ok) {
        if ("warnings" in res) return setWarnings(res.warnings);
        return toast({ tone: "error", title: res.error });
      }
      const name = counsellors.find((c) => c.id === counsellorId)?.name ?? "Counsellor";
      toast({ tone: "success", title: "Counsellor assigned", description: `${name.split(" ")[0]} is set for ${roomName} on the chosen days.` });
      reset();
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" strokeWidth={2} aria-hidden /> Assign
      </Button>

      <Dialog
        open={open}
        onClose={reset}
        title="Assign a counsellor"
        description={`Set a recurring day and time pattern in ${roomName}. A counsellor can hold different rooms on different days.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset} disabled={pending}>Cancel</Button>
            {warnings.length > 0 ? (
              <Button variant="danger" onClick={() => submit(true)} loading={pending}>Assign anyway</Button>
            ) : (
              <Button onClick={() => submit(false)} loading={pending}>Save assignment</Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Counsellor</Label>
            <SearchSelect
              avatars
              value={counsellorId}
              onChange={(v) => { setWarnings([]); setCounsellorId(v); }}
              placeholder="Choose a counsellor"
              searchPlaceholder="Search counsellors…"
              ariaLabel="Assign counsellor"
              options={counsellors.map((c) => ({ value: c.id, label: c.name }))}
              invalid={Boolean(attempted && errors.counsellor)}
            />
            {attempted && errors.counsellor ? <FieldError>{errors.counsellor}</FieldError> : null}
          </div>

          <div>
            <Label>Days</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = days.includes(d.n);
                return (
                  <button key={d.n} type="button" onClick={() => toggleDay(d.n)} className={cn("h-9 w-11 rounded-control border text-[12.5px] font-medium transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}>{d.label}</button>
                );
              })}
            </div>
            {attempted && errors.days ? <FieldError>{errors.days}</FieldError> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <TimePicker minuteStep={15} value={startTime} onChange={(v) => { setWarnings([]); setStartTime(v); }} ariaLabel="Assignment starts" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <TimePicker minuteStep={15} value={endTime} onChange={(v) => { setWarnings([]); setEndTime(v); }} invalid={Boolean(attempted && errors.time)} ariaLabel="Assignment ends" />
            </div>
          </div>
          {attempted && errors.time ? <FieldError>{errors.time}</FieldError> : null}

          {warnings.length > 0 && (
            <div className="space-y-1.5 rounded-control border border-warn/40 bg-warn-soft/40 p-3">
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-warn">
                <AlertTriangle className="size-4" strokeWidth={2} aria-hidden /> Worth a look before you save
              </div>
              <ul className="space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="text-[12.5px] leading-relaxed text-text-2">· {w}</li>
                ))}
              </ul>
              <p className="text-[11.5px] text-text-3">If this is intentional, &ldquo;Assign anyway&rdquo; saves it as-is.</p>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

/** One assigned row with its quiet remove — history stays on the appointment record. */
export function AssignmentRow({ assignment, roomId }: {
  assignment: { id: string; counsellorName: string; days: number[]; start: string; end: string };
  roomId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const remove = () =>
    start(async () => {
      const res = await removeRoomAssignment({ assignmentId: assignment.id, roomId });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Assignment removed", description: "Past sessions in this room stay on the record." });
      router.refresh();
    });

  return (
    <div className="group flex items-center gap-2.5">
      <Avatar name={assignment.counsellorName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-text">{assignment.counsellorName}</div>
        <div className="text-[11.5px] text-text-3">{assignment.days.map((d) => DOW[d]).join(" & ")} · {assignment.start}–{assignment.end}</div>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={`Remove ${assignment.counsellorName}'s assignment`}
        className="rounded p-1 text-text-3 opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
      >
        <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
