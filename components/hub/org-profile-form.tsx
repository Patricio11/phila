"use client";

import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { saveOrgProfile } from "@/app/hub/settings/actions";

export interface OrgProfile {
  name: string;
  tradingName: string;
  registrationNo: string;
  practiceNo: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export function OrgProfileForm({ initial }: { initial: OrgProfile }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState(initial);

  const set = (k: keyof OrgProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const errors = {
    name: form.name.trim().length < 2 ? "Enter your organisation name." : "",
    email: form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) ? "Enter a valid email." : "",
    phone: form.phone && !/^(\+27|0)\d{9}$/.test(form.phone.replace(/\s/g, "")) ? "Use a SA number." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.email || errors.phone) return;
    start(async () => {
      const res = await saveOrgProfile({ ...form, phone: form.phone.replace(/\s/g, "") });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Organisation saved", description: "Your details are updated across the practice." });
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3.5">
        <Avatar name={form.name || "Org"} size="lg" />
        <div className="min-w-0">
          <div className="text-[15px] font-[660] text-text">{form.name || "Your organisation"}</div>
          <div className="text-[12px] text-text-3">{[form.tradingName, form.registrationNo && `Reg. ${form.registrationNo}`].filter(Boolean).join(" · ") || "Practice details"}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organisation name" error={attempted ? errors.name : ""}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={Boolean(attempted && errors.name)} />
        </Field>
        <Field label="Trading as (optional)">
          <Input value={form.tradingName} onChange={(e) => set("tradingName", e.target.value)} placeholder="If different from above" />
        </Field>
        <Field label="Registration / NPO number">
          <Input value={form.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} placeholder="e.g. 123-456 NPO" />
        </Field>
        <Field label="HPCSA practice number">
          <Input value={form.practiceNo} onChange={(e) => set("practiceNo", e.target.value)} placeholder="e.g. 0123456" />
        </Field>
        <Field label="Contact email" error={attempted ? errors.email : ""}>
          <Input inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="admin@practice.co.za" invalid={Boolean(attempted && errors.email)} />
        </Field>
        <Field label="Phone" error={attempted ? errors.phone : ""}>
          <Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="011 234 5678" invalid={Boolean(attempted && errors.phone)} />
        </Field>
        <Field label="Website (optional)">
          <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="www.practice.co.za" />
        </Field>
        <Field label="Physical address" className="sm:col-span-2">
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, suburb, city, postal code" className="min-h-[64px]" />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending}><Building2 className="size-4" strokeWidth={2} aria-hidden /> Save organisation</Button>
      </div>
    </div>
  );
}

function Field({ label, children, error, className }: { label: string; children: React.ReactNode; error?: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
