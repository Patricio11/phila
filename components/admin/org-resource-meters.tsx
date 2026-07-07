"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Mail, HardDrive, Bot, Plus, Check } from "lucide-react";
import type { OrgResourceMeters } from "@/db/queries/resources";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { grantMessagingCredits, setOrgStorageLimit, setOrgAiCap } from "@/app/admin/orgs/actions";
import { cn } from "@/lib/utils";

const GB = 1024 ** 3;
const rands = (cents: number) => `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
const gb = (bytes: number) => (bytes / GB).toFixed(bytes >= GB ? 1 : 2).replace(/\.0+$/, "");

export function OrgResourceMeters({ orgId, meters }: { orgId: string; meters: OrgResourceMeters }) {
  return (
    <div className="space-y-3">
      <CreditMeter orgId={orgId} channel="sms" icon={Smartphone} label="SMS credits" balance={meters.smsCredits} />
      <CreditMeter orgId={orgId} channel="email" icon={Mail} label="Email credits" balance={meters.emailCredits} />
      <StorageMeter orgId={orgId} used={meters.storage.usedBytes} limit={meters.storage.limitBytes} overridden={meters.storage.overridden} />
      <AiMeter orgId={orgId} spent={meters.ai.spentCents} cap={meters.ai.capCents} />
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: "accent" | "warn" | "danger" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn("h-full rounded-full", tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-accent")} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
    </div>
  );
}

function Shell({ icon: Icon, label, right, children }: { icon: typeof Bot; label: string; right: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-control border border-border p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-control bg-surface-2 text-text-2"><Icon className="size-4" strokeWidth={2} aria-hidden /></span>
        <span className="flex-1 text-[13px] font-medium text-text">{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function CreditMeter({ orgId, channel, icon, label, balance }: { orgId: string; channel: "sms" | "email"; icon: typeof Bot; label: string; balance: number }) {
  const { toast } = useToast();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();

  const grant = () => start(async () => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) return toast({ tone: "error", title: "Enter a whole number of credits." });
    const res = await grantMessagingCredits({ orgId, channel, amount: n });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setAmount("");
    toast({ tone: "success", title: `Granted ${n} ${channel} credits`, description: `New balance: ${res.balance.toLocaleString()}` });
    router.refresh();
  });

  return (
    <Shell icon={icon} label={label} right={<span className="text-[13px] font-semibold tabular-nums text-text">{balance.toLocaleString()}</span>}>
      <div className="mt-2.5 flex items-center gap-2">
        <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Add credits" className="h-8 flex-1" />
        <Button size="sm" variant="ghost" onClick={grant} loading={pending} disabled={!amount}><Plus className="size-3.5" strokeWidth={2} aria-hidden /> Grant</Button>
      </div>
    </Shell>
  );
}

function StorageMeter({ orgId, used, limit, overridden }: { orgId: string; used: number; limit: number; overridden: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [gbInput, setGbInput] = useState(String(Math.round(limit / GB)));
  const [pending, start] = useTransition();
  const pct = limit > 0 ? (used / limit) * 100 : 0;

  const setLimit = (clear = false) => start(async () => {
    const val = clear ? null : Number(gbInput);
    if (!clear && (!Number.isInteger(val) || (val as number) < 1)) return toast({ tone: "error", title: "Enter a limit in whole GB." });
    const res = await setOrgStorageLimit({ orgId, gb: val });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: clear ? "Storage limit reset to the plan default" : `Storage limit set to ${val} GB` });
    router.refresh();
  });

  return (
    <Shell icon={HardDrive} label="Storage" right={<span className="text-[12.5px] tabular-nums text-text-2">{gb(used)} / {gb(limit)} GB</span>}>
      <div className="mt-2.5"><Bar pct={pct} tone={pct > 90 ? "danger" : pct > 75 ? "warn" : "accent"} /></div>
      <div className="mt-2.5 flex items-center gap-2">
        <Input value={gbInput} onChange={(e) => setGbInput(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-8 w-24" />
        <span className="text-[12px] text-text-3">GB {overridden && "· overridden"}</span>
        <Button size="sm" variant="ghost" onClick={() => setLimit(false)} loading={pending}><Check className="size-3.5" strokeWidth={2} aria-hidden /> Set</Button>
        {overridden && <Button size="sm" variant="ghost" onClick={() => setLimit(true)} disabled={pending}>Reset to plan</Button>}
      </div>
    </Shell>
  );
}

function AiMeter({ orgId, spent, cap }: { orgId: string; spent: number; cap: number }) {
  const { toast } = useToast();
  const router = useRouter();
  const [capInput, setCapInput] = useState(String(Math.round(cap / 100)));
  const [pending, start] = useTransition();
  const pct = cap > 0 ? (spent / cap) * 100 : 0;

  const save = () => start(async () => {
    const n = Number(capInput);
    if (!Number.isInteger(n) || n < 0) return toast({ tone: "error", title: "Enter a cap in whole Rands." });
    const res = await setOrgAiCap({ orgId, capRands: n });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: `AI monthly cap set to ${rands(n * 100)}` });
    router.refresh();
  });

  return (
    <Shell icon={Bot} label="AI spend (this month)" right={<span className="text-[12.5px] tabular-nums text-text-2">{rands(spent)} / {rands(cap)}</span>}>
      <div className="mt-2.5"><Bar pct={pct} tone={pct > 90 ? "danger" : pct > 75 ? "warn" : "accent"} /></div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[12px] text-text-3">R</span>
        <Input value={capInput} onChange={(e) => setCapInput(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-8 w-28" />
        <span className="text-[12px] text-text-3">/ month cap</span>
        <Button size="sm" variant="ghost" onClick={save} loading={pending}><Check className="size-3.5" strokeWidth={2} aria-hidden /> Set</Button>
      </div>
    </Shell>
  );
}
