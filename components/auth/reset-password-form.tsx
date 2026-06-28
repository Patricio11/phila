"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordField, strength } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { resetPassword } from "@/app/(auth)/actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const errors = {
    password: password.length < 8 || strength(password).score < 1 ? "Use at least 8 characters." : "",
    confirm: confirm !== password ? "The passwords don't match." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.password || errors.confirm) return;
    start(async () => {
      const res = await resetPassword({ password, confirm });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 rounded-card border border-accent/20 bg-accent-soft/30 p-6 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink">
            <CheckCircle2 className="size-6" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <div className="text-[15px] font-[640] text-text">Password updated</div>
            <p className="mt-1 text-[13px] text-text-2">You can now sign in with your new password.</p>
          </div>
        </div>
        <Button onClick={() => router.push("/login")} className="w-full">Go to sign in</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>New password</Label>
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" meter invalid={Boolean(attempted && errors.password)} />
        {attempted && errors.password ? <FieldError>{errors.password}</FieldError> : null}
      </div>
      <div className="space-y-1.5">
        <Label>Confirm new password</Label>
        <PasswordField value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={Boolean(attempted && errors.confirm)} />
        {attempted && errors.confirm ? <FieldError>{errors.confirm}</FieldError> : null}
      </div>
      <Button onClick={submit} loading={pending} className="w-full">Update password</Button>
      <Link href="/login" className="block text-[13px] font-medium text-accent hover:underline">Back to sign in</Link>
    </div>
  );
}
