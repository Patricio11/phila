"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { signIn, homeForCurrentUser, resendVerification } from "@/app/(auth)/actions";
import { authClient } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [resending, startResend] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const errors = {
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email." : "",
    password: !password ? "Enter your password." : "",
  };

  const doSignIn = (creds: { email: string; password: string }) =>
    start(async () => {
      const res = await signIn(creds);
      if (!res.ok) {
        if (res.needsVerification) setUnverified(res.email ?? creds.email);
        return toast({ tone: "error", title: res.error });
      }
      if ("twoFactor" in res) return setTwoFactor(true); // prompt for the TOTP code
      router.push(res.redirect);
    });

  const resend = () => startResend(async () => {
    if (!unverified) return;
    await resendVerification({ email: unverified });
    toast({ tone: "success", title: "Verification sent", description: `Check ${unverified} for the link.` });
  });

  const verifyTwoFactor = () =>
    start(async () => {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) return toast({ tone: "error", title: "That code didn't match  try the next one." });
      const { redirect } = await homeForCurrentUser();
      router.push(redirect);
    });

  const submit = () => {
    setAttempted(true);
    if (errors.email || errors.password) return;
    doSignIn({ email, password });
  };

  if (twoFactor) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="login-totp">Authenticator code</Label>
          <Input id="login-totp" inputMode="numeric" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="tracking-[0.3em]" onKeyDown={(e) => e.key === "Enter" && verifyTwoFactor()} />
          <p className="text-[12px] text-text-3">Enter the 6-digit code from your authenticator app.</p>
        </div>
        <Button onClick={verifyTwoFactor} loading={pending} disabled={code.length < 6} className="w-full">Verify</Button>
        <button type="button" onClick={() => { setTwoFactor(false); setCode(""); }} className="w-full text-center text-[12.5px] font-medium text-text-3 hover:text-text">Back to sign in</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {unverified && (
        <div className="rounded-control border border-warn/30 bg-warn-soft/40 px-3.5 py-3 text-[12.5px] text-text-2">
          <p className="font-medium text-text">Verify your email to continue</p>
          <p className="mt-0.5">We sent a link to {unverified}. Didn&apos;t get it?{" "}
            <button type="button" onClick={resend} disabled={resending} className="font-medium text-accent hover:underline disabled:opacity-50">
              {resending ? "Sending…" : "Resend it"}
            </button>.
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@practice.co.za" invalid={Boolean(attempted && errors.email)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        {attempted && errors.email ? <FieldError>{errors.email}</FieldError> : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Password</Label>
          <Link href="/forgot-password" className="text-[12px] font-medium text-accent hover:underline">Forgot password?</Link>
        </div>
        <PasswordField value={password} onChange={setPassword} invalid={Boolean(attempted && errors.password)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        {attempted && errors.password ? <FieldError>{errors.password}</FieldError> : null}
      </div>

      <Button onClick={submit} loading={pending} className="w-full">Sign in</Button>

      <p className="text-center text-[12.5px] text-text-3">
        New to Phila? <Link href="/signup" className="font-medium text-accent hover:underline">Create a practice</Link>
      </p>
    </div>
  );
}
