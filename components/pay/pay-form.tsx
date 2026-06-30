"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { startInvoicePayment } from "@/app/pay/[token]/actions";

export function PayForm({ token, amountLabel }: { token: string; amountLabel: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pay = () => start(async () => {
    setError(null);
    const res = await startInvoicePayment({ token, email });
    if (!res.ok) { setError(res.error); return; }
    window.location.href = res.url; // → Paystack hosted checkout
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="pay-email">Email for your receipt</Label>
        <Input id="pay-email" type="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@email.co.za" />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-danger"><AlertCircle className="size-3.5" strokeWidth={2} aria-hidden /> {error}</p>
      )}
      <Button className="w-full" onClick={pay} loading={pending} disabled={!email}>
        <Lock className="size-4" strokeWidth={2} aria-hidden /> Pay {amountLabel} securely
      </Button>
      <p className="text-center text-[11px] text-text-3">You&apos;ll be taken to a secure checkout to enter your card details.</p>
    </div>
  );
}
