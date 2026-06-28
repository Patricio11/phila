"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Room } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { RoomFormModal } from "@/components/rooms/room-form-modal";

export function CreateRoomButton({ sites }: { sites: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={2.2} aria-hidden /> Add room
      </Button>
      <RoomFormModal open={open} onClose={() => setOpen(false)} sites={sites} />
    </>
  );
}

export function EditRoomButton({ sites, room }: { sites: { id: string; name: string }[]; room: Room }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" strokeWidth={2} aria-hidden /> Edit room
      </Button>
      <RoomFormModal open={open} onClose={() => setOpen(false)} sites={sites} room={room} />
    </>
  );
}
