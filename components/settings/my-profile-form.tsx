"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import type { CredentialBody, CredentialStatus } from "@/lib/domain/enums";
import { useToast } from "@/components/ui/toast";
import { saveMyProfile } from "@/lib/account/actions";

export interface MyProfile {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  languages: string;
  bio: string;
}

export function MyProfileForm({
  initial,
  credential,
  registrationNo,
}: {
  initial: MyProfile;
  credential: { body: CredentialBody; status: CredentialStatus } | null;
  registrationNo?: string | null;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState(initial);

  const set = (k: keyof MyProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const errors = {
    name: form.name.trim().length < 2 ? "Enter your full name." : "",
    phone: form.phone && !/^(\+27|0)\d{9}$/.test(form.phone.replace(/\s/g, "")) ? "Use a SA number." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.phone) return;
    start(async () => {
      const res = await saveMyProfile({ ...form, phone: form.phone.replace(/\s/g, "") });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Profile saved", description: "Your details are up to date." });
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3.5">
        <Avatar name={form.name || "You"} size="lg" verified={credential?.status === "verified"} />
        <div className="min-w-0">
          <div className="text-[15px] font-[660] text-text">{form.name || "Your name"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {credential && <CredentialChip body={credential.body} status={credential.status} />}
            {registrationNo && <span className="text-[11.5px] text-text-3">Reg. {registrationNo}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={attempted ? errors.name : ""}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={Boolean(attempted && errors.name)} />
        </Field>
        <Field label="Email">
          <div className="flex h-9 items-center gap-2 rounded-control border border-border bg-surface-2 px-3 text-[13.5px] text-text-2">
            <Lock className="size-3.5 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
            <span className="truncate">{form.email}</span>
          </div>
        </Field>
        <Field label="Phone" error={attempted ? errors.phone : ""}>
          <Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="082 123 4567" invalid={Boolean(attempted && errors.phone)} />
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </Field>
        <Field label="Languages">
          <Input value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="English, isiZulu, …" />
        </Field>
        <Field label="Home address" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, suburb, city, postal code" />
        </Field>
        <Field label="About you" className="sm:col-span-2">
          <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="A short bio  shown to your practice and, if you choose, on your public profile." className="min-h-[80px]" />
        </Field>
      </div>

      <p className="text-[11px] text-text-3">Your email and credential are managed by your practice. Ask the hub to change them.</p>

      <Button onClick={submit} loading={pending}>Save profile</Button>
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
