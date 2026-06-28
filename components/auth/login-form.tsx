"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, HeartHandshake, LifeBuoy, Stethoscope } from "lucide-react";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { signIn, homeForCurrentUser } from "@/app/(auth)/actions";
import { authClient } from "@/lib/auth/client";

const DEMOS = [
  { email: "nomsa@masizakhe.org.za", label: "Counsellor", icon: Stethoscope },
  { email: "thandeka@masizakhe.org.za", label: "Practice admin", icon: Briefcase },
  { email: "lerato.m@example.co.za", label: "Client", icon: HeartHandshake },
  { email: "palesa.mokoena@dsd.example.gov.za", label: "Funder", icon: LifeBuoy },
];
const DEMO_PASSWORD = "phila1234";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [code, setCode] = useState("");

  const errors = {
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email." : "",
    password: !password ? "Enter your password." : "",
  };

  const doSignIn = (creds: { email: string; password: string }) =>
    start(async () => {
      const res = await signIn(creds);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      if ("twoFactor" in res) return setTwoFactor(true); // prompt for the TOTP code
      router.push(res.redirect);
    });

  const verifyTwoFactor = () =>
    start(async () => {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) return toast({ tone: "error", title: "That code didn't match — try the next one." });
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
        <PasswordField value={password} onChange={setPassword} invalid={Boolean(attempted && errors.password)} />
        {attempted && errors.password ? <FieldError>{errors.password}</FieldError> : null}
      </div>

      <Button onClick={submit} loading={pending} className="w-full">Sign in</Button>

      {/* Demo workspaces  explore without an account (Part A). */}
      <div className="pt-1">
        <div className="relative flex items-center">
          <span className="h-px flex-1 bg-border" />
          <span className="px-3 text-[11.5px] text-text-3">or explore a demo workspace</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMOS.map((d) => (
            <button key={d.email} type="button" disabled={pending} onClick={() => doSignIn({ email: d.email, password: DEMO_PASSWORD })} className="group flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-[12.5px] font-medium text-text-2 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent disabled:opacity-50">
              <d.icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="flex-1 text-left">{d.label}</span>
              <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2.2} aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
