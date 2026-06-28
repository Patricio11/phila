"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Sparkles, X } from "lucide-react";
import type { PlanWithUsage } from "@/lib/data-provider";
import type { Plan } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}
function tokens(n: number): string {
  if (n === 0) return "No AI";
  return n >= 1000 ? `${Math.round(n / 1000)}k tokens` : `${n} tokens`;
}

export function PlansManager({ initial }: { initial: PlanWithUsage[] }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState(initial);

  const save = (plan: Plan) => {
    setPlans((prev) => prev.map((p) => (p.plan.id === plan.id ? { ...p, plan } : p)));
    toast({ tone: "success", title: `${plan.name} updated`, description: "Entitlements apply to every org on this plan  no drift." });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => toast({ tone: "default", title: "Create a plan", description: "Define a tier, its price, and its entitlements." })}>
          <Plus className="size-4" strokeWidth={2} aria-hidden /> Create plan
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <PlanCard key={p.plan.id} item={p} onSave={save} />
        ))}
      </div>
    </div>
  );
}

function Entitlement({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between text-[12.5px]">
      <span className="text-text-2">{label}</span>
      <span className="font-medium text-text">{value}</span>
    </li>
  );
}

function PlanCard({ item, onSave }: { item: PlanWithUsage; onSave: (plan: Plan) => void }) {
  const { plan, subscribers, mrrCents } = item;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plan);

  return (
    <div className={cn("flex flex-col rounded-card border bg-surface p-5 shadow-sm", plan.popular ? "border-accent/40" : "border-border")}>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-[680] text-text">{plan.name}</h3>
        {plan.popular && (
          <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
            <Sparkles className="size-3" strokeWidth={2.4} aria-hidden /> Popular
          </span>
        )}
        {plan.ngo && <span className="rounded-chip bg-info-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-info">NGO</span>}
      </div>
      <p className="mt-0.5 text-[12px] text-text-3">{plan.tagline}</p>

      {editing ? (
        <div className="mt-4 space-y-2.5">
          <Field label="Price (R/mo)" value={String(Math.round(draft.priceCents / 100))} onChange={(v) => setDraft({ ...draft, priceCents: Number(v || 0) * 100 })} />
          <Field label="Seats (blank = ∞)" value={draft.seats === null ? "" : String(draft.seats)} onChange={(v) => setDraft({ ...draft, seats: v === "" ? null : Number(v) })} />
          <Field label="AI tokens / mo" value={String(draft.aiTokens)} onChange={(v) => setDraft({ ...draft, aiTokens: Number(v || 0) })} />
          <Field label="Video minutes" value={String(draft.videoMinutes)} onChange={(v) => setDraft({ ...draft, videoMinutes: Number(v || 0) })} />
          <Field label="Rooms (blank = ∞)" value={draft.rooms === null ? "" : String(draft.rooms)} onChange={(v) => setDraft({ ...draft, rooms: v === "" ? null : Number(v) })} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => { onSave(draft); setEditing(false); }}>
              <Check className="size-4" strokeWidth={2.4} aria-hidden /> Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setDraft(plan); setEditing(false); }}>
              <X className="size-4" strokeWidth={2} aria-hidden />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-[26px] font-bold tracking-[-0.03em] tabular-nums text-text">{rands(plan.priceCents)}</span>
            <span className="text-[12.5px] text-text-3">/ month</span>
          </div>

          <ul className="mt-4 flex-1 space-y-2 border-t border-border pt-3">
            <Entitlement label="Seats" value={plan.seats === null ? "Unlimited" : String(plan.seats)} />
            <Entitlement label="AI" value={tokens(plan.aiTokens)} />
            <Entitlement label="Video" value={plan.videoMinutes === 0 ? "Paste-link" : `${plan.videoMinutes} min`} />
            <Entitlement label="Messaging" value={plan.messaging ? "WhatsApp + SMS" : ""} />
            <Entitlement label="Rooms" value={plan.rooms === null ? "Unlimited" : String(plan.rooms)} />
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12px]">
            <span className="text-text-3">{subscribers} {subscribers === 1 ? "org" : "orgs"} · {rands(mrrCents)} MRR</span>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              <Pencil className="size-3.5" strokeWidth={2} aria-hidden /> Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} className="h-9" />
    </div>
  );
}
