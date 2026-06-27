"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reassignClient } from "@/app/hub/clients/actions";

export function ReassignClientButton({
  clientId,
  clientName,
  counsellors,
  currentCounsellorId,
}: {
  clientId: string;
  clientName: string;
  counsellors: { id: string; name: string }[];
  currentCounsellorId: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [counsellorId, setCounsellorId] = useState<string | null>(currentCounsellorId ?? counsellors[0]?.id ?? null);
  const [done, setDone] = useState<string | null>(null);

  const submit = () => {
    if (!counsellorId) return;
    start(async () => {
      const res = await reassignClient({ clientId, counsellorId });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const name = counsellors.find((c) => c.id === counsellorId)?.name ?? "";
      setDone(name);
      toast({ tone: "success", title: `${clientName.split(" ")[0]} reassigned`, description: `Now with ${name.split(" ")[0]}. Full history moves with them.` });
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="size-4" strokeWidth={2} aria-hidden /> {done ? `With ${done.split(" ")[0]}` : "Reassign"}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Reassign ${clientName}`}
        description="Move this client to another counsellor. Their history and outcomes move with them."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending}>Reassign</Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <Label>New counsellor</Label>
          <Select value={counsellorId} onChange={setCounsellorId} options={counsellors.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
      </Dialog>
    </>
  );
}
