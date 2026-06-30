"use client";

import { useTransition } from "react";
import type { CreditPack } from "@/lib/payments/packs";
import { useToast } from "@/components/ui/toast";
import { startCreditPurchase } from "@/app/hub/billing/actions";
import { cn } from "@/lib/utils";

export function CreditPacks({ packs }: { packs: CreditPack[] }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const buy = (id: string) => start(async () => {
    const res = await startCreditPurchase({ packId: id });
    if (!res.ok) return toast({ tone: "default", title: "Top-up", description: res.error });
    window.location.href = res.url; // → Paystack checkout
  });

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {packs.map((p) => (
        <button
          key={p.id} type="button" onClick={() => buy(p.id)} disabled={pending}
          className={cn(
            "relative rounded-control border p-3 text-left transition-colors disabled:opacity-60",
            p.popular ? "border-accent/40 bg-accent-soft/30 hover:bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover",
          )}
        >
          {p.popular && <span className="absolute right-2 top-2 rounded-full bg-accent px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white">Popular</span>}
          <div className="text-[18px] font-[720] tabular-nums text-text">{p.credits.toLocaleString()}</div>
          <div className="text-[10.5px] uppercase tracking-wide text-text-3">credits</div>
          <div className="mt-2 text-[13.5px] font-[660] text-text">R{(p.priceCents / 100).toLocaleString()}</div>
        </button>
      ))}
    </div>
  );
}
