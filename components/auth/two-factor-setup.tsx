"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Step = "closed" | "password" | "verify" | "disable";

/**
 * TOTP two-factor (Phase 9, Better Auth). Enable: confirm password → scan the QR
 * in an authenticator app → enter a 6-digit code to confirm. Disable: confirm
 * password. Strongly recommended for admins (they can reach client records).
 */
export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [on, setOn] = useState(enabled);
  const [step, setStep] = useState<Step>("closed");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [backup, setBackup] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep("closed"); setPassword(""); setCode(""); setQr(null); setBackup([]); setError(null); };

  const beginEnable = async () => {
    setError(null);
    setBusy(true);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (error || !data) return setError(error?.message ?? "That password isn't right.");
    setQr(await QRCode.toDataURL(data.totpURI));
    setBackup(data.backupCodes ?? []);
    setStep("verify");
  };

  const confirmEnable = async () => {
    setError(null);
    setBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error) return setError("That code didn't match — try the next one from your app.");
    setOn(true);
    reset();
    toast({ tone: "success", title: "Two-factor enabled", description: "You'll enter a code from your app at sign-in." });
  };

  const confirmDisable = async () => {
    setError(null);
    setBusy(true);
    const { error } = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (error) return setError("That password isn't right.");
    setOn(false);
    reset();
    toast({ tone: "default", title: "Two-factor disabled" });
  };

  return (
    <div className="flex items-start gap-3 rounded-control border border-border p-4">
      <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
        <ShieldCheck className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-[600] text-text">Two-factor authentication</span>
          <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{on ? "On" : "Off"}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">An authenticator-app code at sign-in. Strongly recommended for admins  they can reach client records.</p>
      </div>
      {on ? (
        <Button variant="ghost" size="sm" onClick={() => setStep("disable")}>Disable</Button>
      ) : (
        <Button size="sm" onClick={() => setStep("password")} data-testid="enable-2fa">Enable</Button>
      )}

      {/* Enable — step 1: confirm password */}
      <Dialog open={step === "password"} onClose={reset} title="Enable two-factor" description="Confirm your password to start."
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={reset}>Cancel</Button><Button onClick={beginEnable} loading={busy}>Continue</Button></div>}>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>

      {/* Enable — step 2: scan + verify */}
      <Dialog open={step === "verify"} onClose={reset} title="Scan & confirm" description="Scan the QR in your authenticator app, then enter the 6-digit code."
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={reset}>Cancel</Button><Button onClick={confirmEnable} loading={busy} disabled={code.length < 6}>Confirm</Button></div>}>
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data-URL QR, not a remote asset */}
          {qr && <img src={qr} alt="Two-factor QR code" width={176} height={176} className="mx-auto rounded-control border border-border" />}
          {backup.length > 0 && (
            <div className="rounded-control border border-border bg-surface-2/50 p-3">
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Backup codes (save these)</div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[12px] text-text-2">
                {backup.map((b) => <span key={b}>{b}</span>)}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="totp">6-digit code</Label>
            <Input id="totp" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="tracking-[0.3em]" />
            <FieldError>{error}</FieldError>
          </div>
        </div>
      </Dialog>

      {/* Disable */}
      <Dialog open={step === "disable"} onClose={reset} title="Disable two-factor" description="Confirm your password to turn it off."
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={reset}>Cancel</Button><Button onClick={confirmDisable} loading={busy}>Disable</Button></div>}>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>
    </div>
  );
}
