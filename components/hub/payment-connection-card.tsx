"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Landmark, Lock } from "lucide-react";
import type { PaymentProvider } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const PROVIDERS: { key: PaymentProvider; name: string; blurb: string; icon: typeof Landmark }[] = [
  { key: "stitch", name: "Stitch", blurb: "PayShap & pay-by-bank", icon: Landmark },
  { key: "ozow", name: "Ozow", blurb: "PayShap & instant EFT", icon: Landmark },
  { key: "yoco", name: "Yoco", blurb: "Card payments", icon: CreditCard },
  { key: "paystack", name: "Paystack", blurb: "Card payments", icon: CreditCard },
];

/**
 * PaymentConnectionCard (DESIGN.md §6)  the org connects its **own** gateway so
 * clients pay the org directly. Pick a provider, enter credentials (stored
 * encrypted), Test, and set as default. Mock here; Phase 15B wires the PSP
 * orchestrator. Switching providers is one choice.
 */
export function PaymentConnectionCard() {
  const { toast } = useToast();
  const [connected, setConnected] = useState<PaymentProvider | null>(null);
  const [picking, setPicking] = useState<PaymentProvider | null>(null);
  const [tested, setTested] = useState(false);

  const connectedMeta = PROVIDERS.find((p) => p.key === connected);

  if (connected && connectedMeta) {
    return (
      <div className="rounded-card border border-accent/30 bg-accent-soft/30 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-accent" strokeWidth={2} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-[640] text-text">{connectedMeta.name} connected</div>
            <div className="text-[12px] text-text-2">{connectedMeta.blurb} · clients pay you directly</div>
          </div>
          <Button
            variant="mini"
            onClick={() => { setConnected(null); setPicking(null); setTested(false); toast({ tone: "default", title: "Gateway disconnected" }); }}
          >
            Switch
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => { setPicking(p.key); setTested(false); }}
            aria-pressed={picking === p.key}
            className={cn(
              "flex flex-col items-start gap-1 rounded-control border p-3 text-left transition-colors",
              picking === p.key ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <p.icon className="size-4 text-text-2" strokeWidth={1.9} aria-hidden />
            <span className="text-[13px] font-[600] text-text">{p.name}</span>
            <span className="text-[11px] text-text-3">{p.blurb}</span>
          </button>
        ))}
      </div>

      {picking && (
        <div className="space-y-3 rounded-control border border-border bg-surface-2/60 p-4">
          <p className="flex items-center gap-1.5 text-[12px] text-text-3">
            <Lock className="size-3.5" strokeWidth={2} aria-hidden /> Credentials are stored encrypted and used server-side only.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pay-key" required>API key</Label>
            <Input id="pay-key" placeholder="Paste your key" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-secret" required>API secret</Label>
            <Input id="pay-secret" type="password" placeholder="••••••••••" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setTested(true); toast({ tone: "success", title: "Test connection passed" }); }}>
              Test connection
            </Button>
            <Button
              size="sm"
              disabled={!tested}
              onClick={() => { setConnected(picking); toast({ tone: "success", title: `${PROVIDERS.find((p) => p.key === picking)?.name} set as default`, description: "Clients now pay your org directly." }); }}
            >
              Connect & set default
            </Button>
          </div>
          {!tested && <p className="text-[11.5px] text-text-3">Run a test before connecting.</p>}
        </div>
      )}
    </div>
  );
}
