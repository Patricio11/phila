"use client";

import { useState, useTransition } from "react";
import { ListPlus } from "lucide-react";
import { addToWaitlist } from "@/app/hub/waitlist/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const ANY = "__any";

/** Put a client on the waitlist (W7) — optionally for a specific counsellor, with a note. */
export function AddToWaitlistButton({ clientId, clientName, counsellors }: { clientId: string; clientName: string; counsellors: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [counsellorId, setCounsellorId] = useState<string>(ANY);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    const res = await addToWaitlist({ clientId, counsellorId: counsellorId === ANY ? null : counsellorId, note: note.trim() || undefined });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setOpen(false); setNote(""); setCounsellorId(ANY);
    toast({ tone: "success", title: "Added to waitlist", description: `${clientName.split(" ")[0]} will be offered the next matching slot.` });
  });

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <ListPlus className="size-4" strokeWidth={2} aria-hidden /> Waitlist
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Add ${clientName.split(" ")[0]} to the waitlist`}
        description="When a session is cancelled, matching waitlisted clients are offered the freed slot automatically."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending}>Add to waitlist</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Preferred counsellor <span className="font-normal text-text-3">(optional)</span></Label>
            <Select value={counsellorId} onChange={setCounsellorId} options={[{ value: ANY, label: "Any counsellor" }, ...counsellors.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wl-note">Note <span className="font-normal text-text-3">(optional)</span></Label>
            <Textarea id="wl-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. prefers mornings, or Tuesdays after 2pm" />
          </div>
        </div>
      </Dialog>
    </>
  );
}
