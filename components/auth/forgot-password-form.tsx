"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { requestPasswordReset } from "@/app/(auth)/actions";

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const submit = () => {
    setAttempted(true);
    if (!valid) return;
    start(async () => {
      const res = await requestPasswordReset({ email });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 rounded-card border border-accent/20 bg-accent-soft/30 p-6 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink">
            <MailCheck className="size-6" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <div className="text-[15px] font-[640] text-text">Check your email</div>
            <p className="mt-1 text-[13px] leading-relaxed text-text-2">If an account exists for <span className="font-medium text-text">{email}</span>, we&apos;ve sent a link to reset your password.</p>
          </div>
        </div>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@practice.co.za" invalid={Boolean(attempted && !valid)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        {attempted && !valid ? <FieldError>Enter a valid email.</FieldError> : null}
      </div>
      <Button onClick={submit} loading={pending} className="w-full">Send reset link</Button>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back to sign in
      </Link>
    </div>
  );
}
