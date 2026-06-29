"use client";

import { useState, useTransition } from "react";
import { Mail, Smartphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { grantMessagingCredits } from "@/app/admin/orgs/actions";
import { cn } from "@/lib/utils";

export function GrantCredits({ orgId, balances }: { orgId: string; balances: { sms: number; email: number } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [amount, setAmount] = useState("100");
  const [bal, setBal] = useState(balances);

  const grant = () => start(async () => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1) return toast({ tone: "error", title: "Enter a whole number of credits." });
    const res = await grantMessagingCredits({ orgId, channel, amount: n });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setBal((p) => ({ ...p, [channel]: res.balance }));
    toast({ tone: "success", title: `Granted ${n} ${channel} credits`, description: `New balance: ${res.balance}` });
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Balance icon={Smartphone} label="SMS" value={bal.sms} />
        <Balance icon={Mail} label="Email" value={bal.email} />
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="inline-flex rounded-control border border-border bg-surface p-0.5">
          {(["sms", "email"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setChannel(c)} aria-pressed={channel === c}
              className={cn("rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-[12px] font-medium capitalize transition-colors", channel === c ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text")}>
              {c}
            </button>
          ))}
        </div>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" aria-label="Credit amount" className="w-24" />
        <Button size="sm" onClick={grant} loading={pending}>Grant credits</Button>
      </div>
      <p className="text-[11px] text-text-3">Manual top-up until self-serve purchase lands (Phase 15.1). Recorded in the credit ledger.</p>
    </div>
  );
}

function Balance({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-control border border-border bg-surface-2/40 px-3 py-2">
      <Icon className="size-4 text-text-2" strokeWidth={2} aria-hidden />
      <div>
        <div className="text-[13px] font-[640] text-text">{value}</div>
        <div className="text-[11px] text-text-3">{label} credits</div>
      </div>
      <Wallet className="ml-auto size-3.5 text-text-3" strokeWidth={2} aria-hidden />
    </div>
  );
}
