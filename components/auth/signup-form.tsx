"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PROVINCES, type Province } from "@/lib/domain/enums";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PasswordField, strength } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { registerPractice } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [practiceName, setPracticeName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [province, setProvince] = useState<Province>("Gauteng");
  const [agree, setAgree] = useState(false);

  const errors = {
    practiceName: practiceName.trim().length < 2 ? "Enter your practice name." : "",
    name: name.trim().length < 2 ? "Enter your full name." : "",
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid work email." : "",
    password: strength(password).score < 1 || password.length < 8 ? "Use at least 8 characters." : "",
    agree: !agree ? "Please accept the terms to continue." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
    start(async () => {
      const res = await registerPractice({ practiceName: practiceName.trim(), name: name.trim(), email, password, province, agree: true });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      router.push("/onboarding");
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Practice / organisation name</Label>
        <Input value={practiceName} onChange={(e) => setPracticeName(e.target.value)} placeholder="e.g. Masizakhe Counselling" invalid={Boolean(attempted && errors.practiceName)} />
        {attempted && errors.practiceName ? <FieldError>{errors.practiceName}</FieldError> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Your full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" invalid={Boolean(attempted && errors.name)} />
          {attempted && errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Province</Label>
          <Select value={province} onChange={(v) => setProvince(v as Province)} options={PROVINCES.map((p) => ({ value: p, label: p }))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Work email</Label>
        <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@practice.co.za" invalid={Boolean(attempted && errors.email)} />
        {attempted && errors.email ? <FieldError>{errors.email}</FieldError> : null}
      </div>

      <div className="space-y-1.5">
        <Label>Create a password</Label>
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" meter invalid={Boolean(attempted && errors.password)} />
        {attempted && errors.password ? <FieldError>{errors.password}</FieldError> : null}
      </div>

      <button type="button" onClick={() => setAgree((v) => !v)} className="flex w-full items-start gap-2.5 text-left">
        <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors", agree ? "border-accent bg-accent text-accent-ink" : attempted && errors.agree ? "border-danger" : "border-border-strong")}>
          {agree && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
        </span>
        <span className="text-[12.5px] leading-relaxed text-text-2">I agree to Phila&apos;s terms and to POPIA-compliant processing. I&apos;m authorised to set up this practice.</span>
      </button>
      {attempted && errors.agree ? <FieldError>{errors.agree}</FieldError> : null}

      <Button onClick={submit} loading={pending} className="w-full">Create your practice</Button>
    </div>
  );
}
