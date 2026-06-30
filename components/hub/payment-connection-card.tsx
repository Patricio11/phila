"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CreditCard, Landmark, Lock, Plug, XCircle } from "lucide-react";
import type { PaymentProvider } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveOrgGatewayConfig, testOrgGatewayConnection } from "@/app/hub/settings/payment-actions";
import { cn } from "@/lib/utils";

const PROVIDERS: { key: PaymentProvider; name: string; blurb: string; icon: typeof Landmark; live: boolean }[] = [
  { key: "paystack", name: "Paystack", blurb: "Cards · live", icon: CreditCard, live: true },
  { key: "stitch", name: "Stitch", blurb: "PayShap · soon", icon: Landmark, live: false },
  { key: "ozow", name: "Ozow", blurb: "Instant EFT · soon", icon: Landmark, live: false },
  { key: "yoco", name: "Yoco", blurb: "Cards · soon", icon: CreditCard, live: false },
];

/**
 * PaymentConnectionCard (Phase 15B) — the org connects its **own** gateway so
 * clients pay it directly (funds settle to the org, not Phila). Paystack is wired:
 * paste the secret key, Test connection, switch on. Encrypted at rest.
 */
export function PaymentConnectionCard({ initial }: { initial: { provider: string | null; enabled: boolean; configured: boolean } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [configured, setConfigured] = useState(initial.configured);
  const [picking, setPicking] = useState<PaymentProvider | null>(initial.provider as PaymentProvider | null);
  const [secretKey, setSecretKey] = useState("");
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);

  const save = (nextEnabled: boolean) => start(async () => {
    const res = await saveOrgGatewayConfig({ provider: "paystack", secretKey, enabled: nextEnabled });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setEnabled(nextEnabled);
    if (secretKey) setConfigured(true);
    setSecretKey("");
    toast({ tone: "success", title: nextEnabled ? "Paystack switched on" : "Saved", description: nextEnabled ? "Clients now pay your org directly." : undefined });
  });

  const runTest = () => startTest(async () => {
    const res = await testOrgGatewayConnection({ secretKey });
    setTest(res);
    toast({ tone: res.ok ? "success" : "error", title: res.ok ? "Connection OK" : "Connection failed", description: res.detail });
  });

  if (enabled) {
    return (
      <div className="rounded-card border border-accent/30 bg-accent-soft/30 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-[640] text-text">Paystack connected</div>
            <div className="text-[12px] text-text-2">Cards · clients pay your org directly, funds settle to you.</div>
          </div>
          <Button variant="mini" onClick={() => save(false)} disabled={pending}>Switch off</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROVIDERS.map((p) => (
          <button
            key={p.key} type="button" disabled={!p.live}
            onClick={() => { setPicking(p.key); setTest(null); }}
            aria-pressed={picking === p.key}
            className={cn(
              "flex flex-col items-start gap-1 rounded-control border p-3 text-left transition-colors",
              !p.live && "cursor-not-allowed opacity-55",
              picking === p.key ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <p.icon className="size-4 text-text-2" strokeWidth={1.9} aria-hidden />
            <span className="text-[13px] font-[600] text-text">{p.name}</span>
            <span className="text-[11px] text-text-3">{p.blurb}</span>
          </button>
        ))}
      </div>

      {picking === "paystack" && (
        <div className="space-y-3 rounded-control border border-border bg-surface-2/60 p-4">
          <p className="flex items-center gap-1.5 text-[12px] text-text-3">
            <Lock className="size-3.5" strokeWidth={2} aria-hidden /> Your secret key is stored encrypted and used server-side only.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pay-secret" required>Paystack secret key</Label>
            <Input id="pay-secret" type="password" value={secretKey} onChange={(e) => { setSecretKey(e.target.value); setTest(null); }} placeholder={configured ? "•••••• (leave blank to keep)" : "sk_live_… or sk_test_…"} />
          </div>
          {test && (
            <div className={cn("flex items-center gap-1.5 text-[12px]", test.ok ? "text-accent" : "text-danger")}>
              {test.ok ? <CheckCircle2 className="size-3.5" strokeWidth={2.4} aria-hidden /> : <XCircle className="size-3.5" strokeWidth={2.4} aria-hidden />}
              {test.detail}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={runTest} loading={testing} disabled={!secretKey && !configured}>
              <Plug className="size-3.5" strokeWidth={2} aria-hidden /> Test connection
            </Button>
            <Button size="sm" onClick={() => save(true)} loading={pending} disabled={!secretKey && !configured}>Connect &amp; switch on</Button>
          </div>
        </div>
      )}
    </div>
  );
}
