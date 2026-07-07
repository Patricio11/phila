"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, MailCheck, Sparkles } from "lucide-react";
import { PROVINCES, type Province } from "@/lib/domain/enums";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PasswordField, strength } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { registerPractice, resendVerification } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

export function SignupForm({ planId = null, planName = null }: { planId?: string | null; planName?: string | null }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [resending, startResend] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
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
      const res = await registerPractice({ practiceName: practiceName.trim(), name: name.trim(), email, password, province, planId: planId ?? undefined, agree: true });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setSentTo(res.email);
    });
  };

  const resend = () => startResend(async () => {
    if (!sentTo) return;
    await resendVerification({ email: sentTo });
    toast({ tone: "success", title: "Sent again", description: `A fresh link is on its way to ${sentTo}.` });
  });

  // After sign-up: a calm "check your email" state  the account exists but sign-in is
  // gated until the address is verified.
  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="size-7" strokeWidth={2} aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-[18px] font-[680] tracking-[-0.02em] text-text">Check your email</h2>
          <p className="text-[13.5px] leading-relaxed text-text-2">
            We&apos;ve sent a verification link to <span className="font-medium text-text">{sentTo}</span>. Click it to activate your practice and start your <span className="font-medium text-text">17-day free trial</span>.
          </p>
        </div>
        <div className="rounded-control border border-border bg-surface-2/50 px-4 py-3 text-left text-[12.5px] text-text-2">
          Didn&apos;t get it? Check spam, or resend below. The link expires in an hour.
        </div>
        <Button variant="ghost" onClick={resend} loading={resending} className="w-full">Resend verification email</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trial reminder  reflects a plan picked on the landing page, changeable later. */}
      <div className="flex items-start gap-2.5 rounded-control border border-accent/25 bg-accent-soft/40 px-3.5 py-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
        <div className="min-w-0 text-[12.5px] leading-relaxed text-text-2">
          <span className="font-medium text-text">
            {planName ? `Starting your 17-day free trial on the ${planName} plan` : "Starting your 17-day free trial"}
          </span>{" "}
           no card needed.{" "}
          <Link href="/#pricing" className="font-medium text-accent hover:underline">
            {planName ? "Change plan" : "See plans"}
          </Link>{" "}
          any time.
        </div>
      </div>

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
