"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus } from "lucide-react";
import { FUNDER_TYPES, type FunderType } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createFunder, updateFunder } from "@/app/hub/funders/actions";

export const FUNDER_TYPE_LABELS: Record<FunderType, string> = {
  government: "Government",
  lottery: "Lottery (NLC)",
  corporate_csi: "Corporate CSI",
  foundation: "Foundation",
  international: "International donor",
};

type FunderInit = { id: string; name: string; type: FunderType; contactName: string; contactEmail: string };

export function FunderFormButton({ funder }: { funder?: FunderInit }) {
  const { toast } = useToast();
  const router = useRouter();
  const editing = Boolean(funder);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);

  const [name, setName] = useState(funder?.name ?? "");
  const [type, setType] = useState<FunderType>(funder?.type ?? "government");
  const [contactName, setContactName] = useState(funder?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(funder?.contactEmail ?? "");

  const errors = {
    name: name.trim().length < 2 ? "Enter the funder's name." : "",
    email: contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail) ? "Enter a valid email." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.email) return;
    start(async () => {
      const payload = { name: name.trim(), type, contactName: contactName.trim(), contactEmail: contactEmail.trim() };
      const res = editing ? await updateFunder({ ...payload, funderId: funder!.id }) : await createFunder(payload);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: editing ? "Funder updated" : "Funder added", description: `${name.trim()} saved.` });
      setOpen(false);
      setAttempted(false);
      router.refresh();
    });
  };

  return (
    <>
      {editing ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-4" strokeWidth={2} aria-hidden /> Edit
        </Button>
      ) : (
        <Button variant="subtle" onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={2} aria-hidden /> Add funder
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${funder!.name}` : "Add a funder"}
        description="A funder is the organisation that supports your work  a grant sits under it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending}>{editing ? "Save funder" : "Add funder"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Funder name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Department of Social Development" invalid={Boolean(attempted && errors.name)} />
            {attempted && errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onChange={(v) => setType(v as FunderType)} options={FUNDER_TYPES.map((t) => ({ value: t, label: FUNDER_TYPE_LABELS[t] }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact name <span className="text-text-3">(optional)</span></Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Programme officer" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact email <span className="text-text-3">(optional)</span></Label>
              <Input inputMode="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="funding@example.org" invalid={Boolean(attempted && errors.email)} />
              {attempted && errors.email ? <FieldError>{errors.email}</FieldError> : null}
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-control bg-surface-2/50 p-3">
            <Building2 className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
            <p className="text-[12px] leading-relaxed text-text-2">Add the funder here, then create a grant under it with its own targets and reporting schedule.</p>
          </div>
        </div>
      </Dialog>
    </>
  );
}
