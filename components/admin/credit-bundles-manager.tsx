"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Power } from "lucide-react";
import type { CreditBundleRow } from "@/db/queries/credit-bundles";
import { CHANNEL_LABEL, CREDIT_UNIT, type CreditChannel } from "@/lib/payments/packs";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { saveCreditBundle, setCreditBundleActive } from "@/app/admin/plans/actions";
import { cn } from "@/lib/utils";

const CHANNELS: CreditChannel[] = ["sms", "email", "video", "voice"];
const rands = (c: number) => `R${(c / 100).toLocaleString("en-ZA")}`;

/**
 * Phase 33.1 - the credit catalogue manager. Every bundle an org can buy
 * (SMS / Email / LivePhila / VoicePhila) is a row here: quantity, price,
 * active flag. Zero hardcoded prices - orgs see exactly what's published.
 */
export function CreditBundlesManager({ initial }: { initial: CreditBundleRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<CreditBundleRow | "new" | null>(null);
  const [, start] = useTransition();

  const toggle = (b: CreditBundleRow) =>
    start(async () => {
      const res = await setCreditBundleActive({ id: b.id, active: !b.active });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setRows((prev) => prev.map((x) => (x.id === b.id ? { ...x, active: !b.active } : x)));
      toast({ tone: "success", title: !b.active ? `${b.name} is on sale again` : `${b.name} withdrawn`, description: !b.active ? "Orgs can buy it now." : "Orgs no longer see it; balances are untouched." });
    });

  return (
    <Card>
      <CardHead
        title="Credit bundles"
        action={<Button size="sm" onClick={() => setEditing("new")}><Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> New bundle</Button>}
      />
      <div className="space-y-4 px-[17px] pb-[17px]">
        <p className="text-[12.5px] leading-relaxed text-text-2">
          What every practice can buy - SMS and Email credits, LivePhila and VoicePhila minutes. Prices live here, not in code; changes reach org Billing immediately.
        </p>
        {CHANNELS.map((ch) => {
          const list = rows.filter((r) => r.channel === ch).sort((a, b) => a.sort - b.sort || a.priceCents - b.priceCents);
          if (list.length === 0) return null;
          return (
            <div key={ch}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">{CHANNEL_LABEL[ch]}</div>
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                {list.map((b) => (
                  <li key={b.id} className={cn("flex items-center gap-3 px-3.5 py-2.5", !b.active && "opacity-55")}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-text">{b.name}</div>
                      <div className="text-[11.5px] text-text-3">{b.credits.toLocaleString()} {CREDIT_UNIT[b.channel]} · {b.popular ? "popular · " : ""}{b.active ? "on sale" : "withdrawn"}</div>
                    </div>
                    <span className="shrink-0 text-[14px] font-[680] tabular-nums text-text">{rands(b.priceCents)}</span>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(b)} aria-label={`Edit ${b.name}`}><Pencil className="size-3.5" strokeWidth={2} aria-hidden /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(b)} aria-label={`${b.active ? "Withdraw" : "Activate"} ${b.name}`}>
                      <Power className={cn("size-3.5", b.active ? "text-accent" : "text-text-3")} strokeWidth={2} aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {editing && (
        <BundleDialog
          bundle={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(b) => {
            setRows((prev) => {
              const i = prev.findIndex((x) => x.id === b.id);
              return i >= 0 ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b];
            });
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function BundleDialog({ bundle, onClose, onSaved }: { bundle: CreditBundleRow | null; onClose: () => void; onSaved: (b: CreditBundleRow) => void }) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<CreditChannel>(bundle?.channel ?? "voice");
  const [name, setName] = useState(bundle?.name ?? "");
  const [credits, setCredits] = useState(bundle ? String(bundle.credits) : "");
  const [priceR, setPriceR] = useState(bundle ? String(Math.round(bundle.priceCents / 100)) : "");
  const [popular, setPopular] = useState(bundle?.popular ?? false);
  const [saving, start] = useTransition();

  const save = () =>
    start(async () => {
      const id = bundle?.id ?? `${channel}_${credits || "0"}`.toLowerCase();
      const res = await saveCreditBundle({
        id, channel,
        name: name.trim() || `${CHANNEL_LABEL[channel]} ${Number(credits || 0).toLocaleString()}`,
        credits: Number(credits || 0),
        priceCents: Math.round(Number(priceR || 0) * 100),
        popular,
        sort: bundle?.sort ?? 0,
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Bundle saved", description: "Org Billing shows it immediately." });
      onSaved({
        id, channel, name: name.trim() || `${CHANNEL_LABEL[channel]} ${Number(credits || 0).toLocaleString()}`,
        credits: Number(credits || 0), priceCents: Math.round(Number(priceR || 0) * 100),
        popular, active: true, sort: bundle?.sort ?? 0,
      });
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title={bundle ? `Edit ${bundle.name}` : "New credit bundle"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} loading={saving} disabled={!Number(credits) || !Number(priceR)}>Save bundle</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select ariaLabel="Channel" value={channel} onChange={(v) => v && setChannel(v as CreditChannel)} options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input aria-label="Bundle name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VoicePhila 1 000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{CREDIT_UNIT[channel] === "minutes" ? "Minutes" : "Credits"}</Label>
            <Input aria-label="Bundle quantity" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label>Price (R)</Label>
            <Input aria-label="Bundle price in rands" inputMode="numeric" value={priceR} onChange={(e) => setPriceR(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-control border border-border p-2.5 text-[13px] text-text-2">
          <input type="checkbox" checked={popular} onChange={(e) => setPopular(e.target.checked)} className="size-4" />
          Mark as the popular choice
          {popular && <Check className="ml-auto size-4 text-accent" strokeWidth={2.2} aria-hidden />}
        </label>
      </div>
    </Dialog>
  );
}
