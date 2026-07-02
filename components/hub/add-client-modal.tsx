"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import { PROVINCES, type Province } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/app/hub/clients/actions";
import { cn } from "@/lib/utils";

export function AddClientButton({ counsellors }: { counsellors: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState<Province>("Gauteng");
  const [counsellorId, setCounsellorId] = useState<string | null>(counsellors[0]?.id ?? null);
  const [riskFlag, setRiskFlag] = useState(false);

  const errors = {
    name: name.trim().length < 2 ? "Enter the client's full name." : "",
    counsellor: !counsellorId ? "Assign a counsellor." : "",
    phone: phone && !/^(\+27|0)\d{9}$/.test(phone.replace(/\s/g, "")) ? "Use a SA number, e.g. 082 123 4567." : "",
    email: email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email." : "",
    contact: !phone.trim() && !email.trim() ? "Add a phone number or an email — either works." : "",
  };

  const reset = () => { setName(""); setPhone(""); setEmail(""); setProvince("Gauteng"); setCounsellorId(counsellors[0]?.id ?? null); setRiskFlag(false); setAttempted(false); };

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.counsellor || errors.phone || errors.email || errors.contact) return;
    start(async () => {
      const res = await createClient({ name: name.trim(), phone: phone.replace(/\s/g, ""), email, province, counsellorId: counsellorId!, riskFlag });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Client added", description: `${name.split(" ")[0]} is on ${counsellors.find((c) => c.id === counsellorId)?.name.split(" ")[0]}'s caseload.` });
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Add client
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a client"
        description="Capture the essentials  consent is requested at first contact."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending}>Add client</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thandiwe Nkosi" invalid={Boolean(attempted && errors.name)} />
            {attempted && errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="082 123 4567" invalid={Boolean(attempted && (errors.phone || errors.contact))} />
                {attempted && errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" invalid={Boolean(attempted && (errors.email || errors.contact))} />
                {attempted && errors.email ? <FieldError>{errors.email}</FieldError> : null}
              </div>
            </div>
            {attempted && errors.contact ? (
              <FieldError>{errors.contact}</FieldError>
            ) : (
              <p className="text-[11.5px] text-text-3">One is enough. We invite by email when there&apos;s one, otherwise by SMS to their number.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Select value={province} onChange={(v) => setProvince(v as Province)} options={PROVINCES.map((p) => ({ value: p, label: p }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Primary counsellor</Label>
              <Select value={counsellorId} onChange={setCounsellorId} placeholder="Assign" options={counsellors.map((c) => ({ value: c.id, label: c.name }))} invalid={Boolean(attempted && errors.counsellor)} />
              {attempted && errors.counsellor ? <FieldError>{errors.counsellor}</FieldError> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRiskFlag((v) => !v)}
            className={cn("flex w-full items-start gap-2.5 rounded-control border p-3 text-left transition-colors", riskFlag ? "border-danger/40 bg-danger-soft/50" : "border-border bg-surface hover:bg-surface-hover")}
          >
            <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", riskFlag ? "text-danger" : "text-text-3")} strokeWidth={2} aria-hidden />
            <span>
              <span className="block text-[13px] font-medium text-text">Open with a safeguarding flag</span>
              <span className="block text-[11.5px] text-text-2">Only if there&apos;s a known concern. It&apos;s never auto-actioned  it just keeps the counsellor close.</span>
            </span>
            <span className={cn("ml-auto mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", riskFlag ? "bg-danger" : "bg-surface-2")}>
              <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", riskFlag && "translate-x-4")} />
            </span>
          </button>
        </div>
      </Dialog>
    </>
  );
}
