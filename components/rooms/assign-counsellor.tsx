"use client";

import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Label, FieldError } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveRoomAssignment } from "@/app/hub/rooms/actions";
import { cn } from "@/lib/utils";

const DAYS: { n: number; label: string }[] = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" }, { n: 4, label: "Thu" },
  { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 7, label: "Sun" },
];

export function AssignCounsellorButton({ roomId, roomName, counsellors }: { roomId: string; roomName: string; counsellors: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);

  const [counsellorId, setCounsellorId] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([1, 3]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("13:00");

  const errors = {
    counsellor: !counsellorId ? "Pick a counsellor." : "",
    days: days.length === 0 ? "Pick at least one day." : "",
    time: endTime <= startTime ? "End must be after start." : "",
  };

  const toggleDay = (n: number) => setDays((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n].sort()));

  const submit = () => {
    setAttempted(true);
    if (errors.counsellor || errors.days || errors.time) return;
    start(async () => {
      const res = await saveRoomAssignment({ roomId, counsellorId: counsellorId!, days, start: startTime, end: endTime });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const name = counsellors.find((c) => c.id === counsellorId)?.name ?? "Counsellor";
      toast({ tone: "success", title: "Counsellor assigned", description: `${name.split(" ")[0]} is set for ${roomName} on the chosen days.` });
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" strokeWidth={2} aria-hidden /> Assign
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Assign a counsellor"
        description={`Set a recurring day and time pattern in ${roomName}.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending}>Save assignment</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Counsellor</Label>
            <Select value={counsellorId} onChange={setCounsellorId} placeholder="Choose a counsellor" options={counsellors.map((c) => ({ value: c.id, label: c.name }))} invalid={Boolean(attempted && errors.counsellor)} />
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
              <TimePicker minuteStep={15} value={startTime} onChange={setStartTime} ariaLabel="Assignment starts" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <TimePicker minuteStep={15} value={endTime} onChange={setEndTime} invalid={Boolean(attempted && errors.time)} ariaLabel="Assignment ends" />
            </div>
          </div>
          {attempted && errors.time ? <FieldError>{errors.time}</FieldError> : null}
        </div>
      </Dialog>
    </>
  );
}
