"use client";

import { useState, useTransition } from "react";
import { Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, FieldError } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";

export function SecuritySettings({ initialTwoFactor }: { initialTwoFactor: boolean }) {
  const { toast } = useToast();
  const [pwPending, startPw] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const errors = {
    current: !pw.current ? "Enter your current password." : "",
    next: pw.next.length < 8 ? "Use at least 8 characters." : "",
    confirm: pw.confirm !== pw.next ? "Passwords don't match." : "",
  };

  const submitPw = () => {
    setAttempted(true);
    if (errors.current || errors.next || errors.confirm) return;
    startPw(async () => {
      const { error } = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: true });
      if (error) return toast({ tone: "error", title: "That current password isn't right." });
      toast({ tone: "success", title: "Password changed", description: "Other sessions were signed out for safety." });
      setPw({ current: "", next: "", confirm: "" });
      setAttempted(false);
    });
  };

  return (
    <div className="space-y-5">
      {/* 2FA (real TOTP enrolment) */}
      <TwoFactorSetup enabled={initialTwoFactor} />

      {/* Change password */}
      <div>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">
          <KeyRound className="size-3.5" strokeWidth={2} aria-hidden /> Change password
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <PasswordField value={pw.current} onChange={(v) => setPw((p) => ({ ...p, current: v }))} autoComplete="current-password" invalid={Boolean(attempted && errors.current)} />
            {attempted && errors.current ? <FieldError>{errors.current}</FieldError> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <PasswordField value={pw.next} onChange={(v) => setPw((p) => ({ ...p, next: v }))} autoComplete="new-password" meter invalid={Boolean(attempted && errors.next)} />
              {attempted && errors.next ? <FieldError>{errors.next}</FieldError> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <PasswordField value={pw.confirm} onChange={(v) => setPw((p) => ({ ...p, confirm: v }))} autoComplete="new-password" invalid={Boolean(attempted && errors.confirm)} />
              {pw.confirm.length > 0 && pw.confirm === pw.next ? (
                <p className="flex items-center gap-1 text-[11.5px] font-medium text-accent"><Check className="size-3.5" strokeWidth={2.5} aria-hidden /> Passwords match</p>
              ) : attempted && errors.confirm ? <FieldError>{errors.confirm}</FieldError> : null}
            </div>
          </div>
          <Button size="sm" onClick={submitPw} loading={pwPending}>Update password</Button>
        </div>
      </div>
    </div>
  );
}
