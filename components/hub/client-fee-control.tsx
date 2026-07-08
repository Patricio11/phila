"use client";

import { useState, useTransition } from "react";
import { HandCoins, Check, Pencil, X } from "lucide-react";
import { setClientFee } from "@/app/hub/clients/actions";
import { effectiveFeeCents, feeLabel, isSubsidised, type FeeKind, type FeePolicy } from "@/lib/billing/fees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const rands = (c: number) => `R${Math.round(c / 100).toLocaleString("en-ZA")}`;

const KINDS: { kind: FeeKind; label: string; hint: string }[] = [
  { kind: "standard", label: "Standard", hint: "Pays the full list price" },
  { kind: "percentage", label: "Sliding scale", hint: "Pays a share of the list price" },
  { kind: "fixed", label: "Fixed fee", hint: "A flat amount per session" },
  { kind: "waived", label: "Waived", hint: "Funded — pays nothing" },
];

const PCT_PRESETS = [25, 50, 75];

/**
 * Sliding-scale / subsidised fee for a client (W7). What they pay flows straight into
 * the invoice raised when a session is booked — so funded/subsidised clients are billed
 * correctly, automatically. The preview shows exactly what they'll pay per service.
 */
export function ClientFeeControl({
  clientId,
  clientName,
  initial,
  services,
}: {
  clientId: string;
  clientName: string;
  initial: FeePolicy | null;
  services: { name: string; priceCents: number }[];
}) {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<FeePolicy | null>(initial);
  const [editing, setEditing] = useState(false);
  const [draftKind, setDraftKind] = useState<FeeKind>(initial?.kind ?? "standard");
  const [pct, setPct] = useState(initial?.kind === "percentage" ? String(initial.value ?? 50) : "50");
  const [fixedR, setFixedR] = useState(initial?.kind === "fixed" ? String(Math.round((initial.value ?? 0) / 100)) : "");
  const [pending, start] = useTransition();

  const first = clientName.split(" ")[0];
  const draftPolicy: FeePolicy | null =
    draftKind === "standard" ? null :
    draftKind === "waived" ? { kind: "waived" } :
    draftKind === "percentage" ? { kind: "percentage", value: Number(pct || 0) } :
    { kind: "fixed", value: Number(fixedR || 0) * 100 };

  const open = () => {
    setDraftKind(policy?.kind ?? "standard");
    setPct(policy?.kind === "percentage" ? String(policy.value ?? 50) : "50");
    setFixedR(policy?.kind === "fixed" ? String(Math.round((policy.value ?? 0) / 100)) : "");
    setEditing(true);
  };

  const save = () => start(async () => {
    const res = await setClientFee({ clientId, kind: draftKind, value: draftPolicy && "value" in draftPolicy ? draftPolicy.value : undefined });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setPolicy(draftPolicy);
    setEditing(false);
    toast({ tone: "success", title: "Fee updated", description: `New sessions bill ${first} at their ${feeLabel(draftPolicy).toLowerCase()}.` });
  });

  const activePolicy = editing ? draftPolicy : policy;

  return (
    <div className="px-[17px] pb-[17px]">
      {!editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[12px] font-semibold", isSubsidised(policy) ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-2")}>
              <HandCoins className="size-3.5" strokeWidth={2} aria-hidden /> {feeLabel(policy)}
            </span>
            <button type="button" onClick={open} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
              <Pencil className="size-3.5" strokeWidth={2} aria-hidden /> Edit
            </button>
          </div>
          {isSubsidised(policy) ? (
            <p className="text-[12px] leading-relaxed text-text-2">Invoices raised when {first} books are billed at this rate  automatically.</p>
          ) : (
            <p className="text-[12px] leading-relaxed text-text-2">{first} pays the standard list price. Set a subsidised or waived fee for funded / hardship cases.</p>
          )}
          {services.length > 0 && <FeeTable services={services} policy={activePolicy} />}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => setDraftKind(k.kind)}
                className={cn("rounded-control border px-2.5 py-2 text-left transition-colors", draftKind === k.kind ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-hover")}
              >
                <div className={cn("text-[12.5px] font-[620]", draftKind === k.kind ? "text-accent" : "text-text")}>{k.label}</div>
                <div className="mt-0.5 text-[10.5px] leading-tight text-text-3">{k.hint}</div>
              </button>
            ))}
          </div>

          {draftKind === "percentage" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Input inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} className="h-9 w-20" />
                <span className="text-[12.5px] text-text-3">% of the list price</span>
              </div>
              <div className="flex gap-1">
                {PCT_PRESETS.map((p) => (
                  <button key={p} type="button" onClick={() => setPct(String(p))} className="rounded-chip border border-border px-2 py-0.5 text-[11px] text-text-3 hover:border-accent hover:text-accent">{p}%</button>
                ))}
              </div>
            </div>
          )}
          {draftKind === "fixed" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] text-text-3">R</span>
              <Input inputMode="numeric" value={fixedR} onChange={(e) => setFixedR(e.target.value.replace(/[^\d]/g, ""))} className="h-9 w-28" placeholder="150" />
              <span className="text-[12.5px] text-text-3">per session</span>
            </div>
          )}

          {services.length > 0 && <FeeTable services={services} policy={draftPolicy} />}

          <div className="flex gap-2 pt-0.5">
            <Button size="sm" className="flex-1" onClick={save} loading={pending}>
              <Check className="size-4" strokeWidth={2.4} aria-hidden /> Save fee
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              <X className="size-4" strokeWidth={2} aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** What the client pays per service under the (draft) policy — the useful bit. */
function FeeTable({ services, policy }: { services: { name: string; priceCents: number }[]; policy: FeePolicy | null }) {
  return (
    <ul className="space-y-1 rounded-control border border-border bg-surface-2/40 p-2.5">
      {services.slice(0, 4).map((s) => {
        const pay = effectiveFeeCents(s.priceCents, policy);
        const reduced = pay < s.priceCents;
        return (
          <li key={s.name} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate text-text-2">{s.name}</span>
            <span className="shrink-0 tabular-nums">
              {reduced && <span className="mr-1.5 text-text-3 line-through">{rands(s.priceCents)}</span>}
              <span className={cn("font-semibold", pay === 0 ? "text-accent" : reduced ? "text-accent" : "text-text")}>{pay === 0 ? "Free" : rands(pay)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
