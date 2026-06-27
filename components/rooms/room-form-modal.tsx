"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { Room } from "@/lib/mock/types";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveRoom } from "@/app/hub/rooms/actions";
import { cn } from "@/lib/utils";

const EQUIPMENT = [
  "Wheelchair access",
  "Play-therapy kit",
  "Sandtray",
  "Soundproofing",
  "Comfortable seating",
  "Projector",
  "Two-way mirror",
  "Hearing loop",
];
const COLOURS = ["#1C7D58", "#3C7FB0", "#9a6418", "#6b4f8a", "#C2554D", "#0E7C7B"];

export function RoomFormModal({
  open,
  onClose,
  sites,
  room,
}: {
  open: boolean;
  onClose: () => void;
  sites: { id: string; name: string }[];
  room?: Room;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);

  const [name, setName] = useState(room?.name ?? "");
  const [siteId, setSiteId] = useState<string | null>(room?.siteId ?? sites[0]?.id ?? null);
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 2));
  const [equipment, setEquipment] = useState<string[]>(room?.equipment ?? []);
  const [status, setStatus] = useState<Room["status"]>(room?.status ?? "active");
  const [colour, setColour] = useState(room?.colour ?? COLOURS[0]!);

  const errors = {
    name: !name.trim() ? "Give the room a name." : "",
    site: !siteId ? "Pick a site." : "",
  };

  const toggleEquip = (e: string) => setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.site) return;
    start(async () => {
      const res = await saveRoom({ id: room?.id, name: name.trim(), siteId: siteId!, capacity: Number(capacity) || 1, equipment, status, colour });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: room ? "Room updated" : "Room created", description: `${name} is ready on the calendar.` });
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={room ? "Edit room" : "Create a room"}
      description="Rooms appear on the calendar and in availability."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={submit} loading={pending}>{room ? "Save room" : "Create room"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Room name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Consulting room 3" invalid={Boolean(attempted && errors.name)} />
          {attempted && errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Site</Label>
            <Select value={siteId} onChange={setSiteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} invalid={Boolean(attempted && errors.site)} />
          </div>
          <div className="space-y-1.5">
            <Label>Capacity</Label>
            <Input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <div>
          <Label>Equipment & access</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EQUIPMENT.map((e) => {
              const on = equipment.includes(e);
              return (
                <button key={e} type="button" onClick={() => toggleEquip(e)} className={cn("rounded-chip border px-2.5 py-1 text-[12px] font-medium transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}>
                  {on && <Check className="mr-1 inline size-3" strokeWidth={2.5} aria-hidden />}{e}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Status</Label>
            <div className="mt-1.5 inline-flex rounded-control border border-border p-0.5">
              {(["active", "maintenance"] as Room["status"][]).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={cn("h-8 rounded-[6px] px-3 text-[12.5px] font-medium capitalize transition-colors", status === s ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text")}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Calendar colour</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {COLOURS.map((c) => (
                <button key={c} type="button" onClick={() => setColour(c)} aria-label={`Use ${c}`} className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-all", colour === c ? "ring-text" : "ring-transparent")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
