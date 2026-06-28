"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordField, strength } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { activateAccount } from "@/app/(auth)/actions";

export function ActivateForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const errors = {
    password: password.length < 8 || strength(password).score < 1 ? "Use at least 8 characters." : "",
    confirm: confirm !== password ? "The passwords don't match." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.password || errors.confirm) return;
    start(async () => {
      const res = await activateAccount({ password, confirm });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Welcome to your space 🌱" });
      router.push("/me");
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Create a password</Label>
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" meter invalid={Boolean(attempted && errors.password)} />
        {attempted && errors.password ? <FieldError>{errors.password}</FieldError> : null}
      </div>
      <div className="space-y-1.5">
        <Label>Confirm password</Label>
        <PasswordField value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={Boolean(attempted && errors.confirm)} />
        {confirm.length > 0 && confirm === password ? (
          <p className="flex items-center gap-1 text-[11.5px] font-medium text-accent"><Check className="size-3.5" strokeWidth={2.5} aria-hidden /> Passwords match</p>
        ) : attempted && errors.confirm ? <FieldError>{errors.confirm}</FieldError> : null}
      </div>
      <Button onClick={submit} loading={pending} className="w-full">Set password &amp; continue</Button>
    </div>
  );
}
