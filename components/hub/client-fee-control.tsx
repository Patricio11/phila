"use client";

import { useState, useTransition } from "react";
import { za } from "@/lib/format";
import { HandCoins, Check, Pencil, X } from "lucide-react";
import { setClientFee } from "@/app/hub/clients/actions";
import { effectiveFeeCents, feeLabel, isSubsidised, type FeePolicy } from "@/lib/billing/fees";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const rands = (c: number) => `R${za(Math.round(c / 100))}`;

type PickableKind = "standard" | "waived" | "retainer";

const KINDS: { kind: PickableKind; label: string; hint: string }[] = [
  { kind: "standard", label: "Standard", hint: "Pays the full list price" },
  { kind: "waived", label: "Waived (funded)", hint: "A grant or donor covers it - pays nothing" },
  { kind: "retainer", label: "Waived (company retainer)", hint: "The employer's retainer covers it - pays nothing" },
];

/**
 * Fee arrangement for a client (W7, reworked 2g): standard, waived (funded), or
 * waived (company retainer - the EAP case). What they pay flows straight into the
 * invoice raised when a session is booked. Legacy sliding-scale/fixed arrangements
 * still display on existing clients; they're just no longer offered here.
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
  const [draftKind, setDraftKind] = useState<PickableKind>(
    initial?.kind === "waived" || initial?.kind === "retainer" ? initial.kind : "standard",
  );
  const [pending, start] = useTransition();

  const first = clientName.split(" ")[0];
  const draftPolicy: FeePolicy | null = draftKind === "standard" ? null : { kind: draftKind };

  const open = () => {
    // A legacy sliding-scale/fixed arrangement opens on Standard - saving replaces it.
    setDraftKind(policy?.kind === "waived" || policy?.kind === "retainer" ? policy.kind : "standard");
    setEditing(true);
  };

  const save = () => start(async () => {
    const res = await setClientFee({ clientId, kind: draftKind });
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
          <div className="grid gap-1.5">
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

/** What the client pays per service under the (draft) policy - the useful bit. */
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
