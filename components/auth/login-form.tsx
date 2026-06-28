"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, HeartHandshake, LifeBuoy, Stethoscope } from "lucide-react";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/password-field";
import { useToast } from "@/components/ui/toast";
import { signIn } from "@/app/(auth)/actions";

const DEMOS = [
  { href: "/app", label: "Counsellor", icon: Stethoscope },
  { href: "/hub", label: "Practice admin", icon: Briefcase },
  { href: "/me", label: "Client", icon: HeartHandshake },
  { href: "/funder", label: "Funder", icon: LifeBuoy },
];

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const errors = {
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email." : "",
    password: !password ? "Enter your password." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.email || errors.password) return;
    start(async () => {
      const res = await signIn({ email, password });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      router.push("/app");
    });
  };

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

      {/* Demo workspaces — explore without an account (Part A). */}
      <div className="pt-1">
        <div className="relative flex items-center">
          <span className="h-px flex-1 bg-border" />
          <span className="px-3 text-[11.5px] text-text-3">or explore a demo workspace</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMOS.map((d) => (
            <Link key={d.href} href={d.href} className="group flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-[12.5px] font-medium text-text-2 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent">
              <d.icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="flex-1">{d.label}</span>
              <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2.2} aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
