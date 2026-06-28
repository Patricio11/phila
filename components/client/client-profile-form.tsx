"use client";

import { useState, useTransition } from "react";
import { Heart, Phone } from "lucide-react";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { saveClientProfile } from "@/app/me/profile/actions";

export interface ClientProfile {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  preferredContact: "WhatsApp" | "Phone call" | "Email";
}

export function ClientProfileForm({ initial }: { initial: ClientProfile }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState(initial);

  const set = (k: keyof ClientProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const errors = {
    name: form.name.trim().length < 2 ? "Please enter your name." : "",
    phone: form.phone && !/^(\+27|0)\d{9}$/.test(form.phone.replace(/\s/g, "")) ? "Use a SA number, e.g. 082 123 4567." : "",
    email: form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) ? "Enter a valid email." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.phone || errors.email) return;
    start(async () => {
      const res = await saveClientProfile({ ...form, phone: form.phone.replace(/\s/g, "") });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Saved", description: "Your details are up to date." });
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={form.name || "You"} size="lg" />
        <div className="min-w-0">
          <div className="text-[16px] font-[660] text-text">{form.name || "Your name"}</div>
          <div className="truncate text-[12.5px] text-text-3">{form.email || form.phone || "Add your contact details"}</div>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Full name" error={attempted ? errors.name : ""}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={Boolean(attempted && errors.name)} autoComplete="name" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile number" error={attempted ? errors.phone : ""}>
            <Input inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="082 123 4567" invalid={Boolean(attempted && errors.phone)} />
          </Field>
          <Field label="Email" error={attempted ? errors.email : ""}>
            <Input inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.co.za" invalid={Boolean(attempted && errors.email)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth">
            <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </Field>
          <Field label="How should we reach you?">
            <Select value={form.preferredContact} onChange={(v) => set("preferredContact", (v as ClientProfile["preferredContact"]) ?? "WhatsApp")} options={[{ value: "WhatsApp", label: "WhatsApp" }, { value: "Phone call", label: "Phone call" }, { value: "Email", label: "Email" }]} />
          </Field>
        </div>
        <Field label="Home address">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, suburb, city, postal code" autoComplete="street-address" />
        </Field>
      </div>

      <div className="rounded-control border border-border bg-surface-2/40 p-4">
        <div className="flex items-center gap-1.5 text-[13px] font-[600] text-text">
          <Heart className="size-4 text-accent" strokeWidth={2} aria-hidden /> Emergency contact
        </div>
        <p className="mt-1 text-[12px] text-text-2">Someone we can reach if we&apos;re ever worried about your safety.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} placeholder="e.g. Thabo (brother)" />
          </Field>
          <Field label="Their number">
            <Input inputMode="tel" value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} placeholder="082 …" />
          </Field>
        </div>
      </div>

      <Button onClick={submit} loading={pending} className="w-full sm:w-auto">
        <Phone className="size-4" strokeWidth={2} aria-hidden /> Save my details
      </Button>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
