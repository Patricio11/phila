"use client";

import { useState, useTransition } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { changePassword, setTwoFactor } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}

export function SecuritySettings({ initialTwoFactor }: { initialTwoFactor: boolean }) {
  const { toast } = useToast();
  const [twoFactor, setTF] = useState(initialTwoFactor);
  const [tfPending, startTF] = useTransition();

  const [pwPending, startPw] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const toggleTF = () =>
    startTF(async () => {
      const next = !twoFactor;
      const res = await setTwoFactor({ enabled: next });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setTF(next);
      toast(next
        ? { tone: "success", title: "Two-factor enabled", description: "You'll be asked for a code at sign-in (TOTP wires in Phase 9)." }
        : { tone: "default", title: "Two-factor disabled" });
    });

  const errors = {
    current: !pw.current ? "Enter your current password." : "",
    next: pw.next.length < 8 ? "Use at least 8 characters." : "",
    confirm: pw.confirm !== pw.next ? "Passwords don't match." : "",
  };

  const submitPw = () => {
    setAttempted(true);
    if (errors.current || errors.next || errors.confirm) return;
    startPw(async () => {
      const res = await changePassword(pw);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Password changed", description: "Use your new password next time you sign in." });
      setPw({ current: "", next: "", confirm: "" });
      setAttempted(false);
    });
  };

  return (
    <div className="space-y-5">
      {/* 2FA */}
      <div className="flex items-start gap-3 rounded-control border border-border p-4">
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", twoFactor ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
          <ShieldCheck className="size-[18px]" strokeWidth={1.9} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-[600] text-text">Two-factor authentication</span>
            <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", twoFactor ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{twoFactor ? "On" : "Off"}</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">An authenticator-app code at sign-in. Strongly recommended for admins — they can reach client records.</p>
        </div>
        <Toggle on={twoFactor} onClick={toggleTF} disabled={tfPending} />
      </div>

      {/* Change password */}
      <div>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">
          <KeyRound className="size-3.5" strokeWidth={2} aria-hidden /> Change password
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} invalid={Boolean(attempted && errors.current)} />
            {attempted && errors.current ? <FieldError>{errors.current}</FieldError> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} invalid={Boolean(attempted && errors.next)} />
              {attempted && errors.next ? <FieldError>{errors.next}</FieldError> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} invalid={Boolean(attempted && errors.confirm)} />
              {attempted && errors.confirm ? <FieldError>{errors.confirm}</FieldError> : null}
            </div>
          </div>
          <Button size="sm" onClick={submitPw} loading={pwPending}>Update password</Button>
        </div>
      </div>
    </div>
  );
}
