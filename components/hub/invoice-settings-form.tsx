"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { InvoiceSettings } from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveInvoiceSettings } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

export function InvoiceSettingsForm({ initial, vatRatePercent }: { initial: InvoiceSettings; vatRatePercent: number }) {
  const { toast } = useToast();
  const [registered, setRegistered] = useState(initial.vatRegistered);
  const [vatNumber, setVatNumber] = useState(initial.vatNumber);
  const [inclusive, setInclusive] = useState(initial.pricesIncludeVat);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await saveInvoiceSettings({ vatRegistered: registered, vatNumber, pricesIncludeVat: inclusive });
    setSaving(false);
    if (res.ok) toast({ tone: "success", title: "Invoicing saved", description: "New invoices use these settings." });
    else setError(res.error);
  };

  return (
    <div className="space-y-4">
      {/* VAT registration */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13.5px] font-medium text-text">VAT registered</div>
          <div className="mt-0.5 text-[12px] text-text-2">
            Turn on if your practice is a registered VAT vendor. The rate ({vatRatePercent}%) is set nationally by the platform.
          </div>
        </div>
        <Toggle on={registered} onClick={() => setRegistered((v) => !v)} />
      </div>

      {registered && (
        <>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="vat-number">VAT number</Label>
            <Input id="vat-number" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="e.g. 4512345678" inputMode="numeric" />
          </div>

          <div className="space-y-1.5">
            <Label>Your service prices are</Label>
            <div className="grid max-w-md grid-cols-2 gap-2">
              <Choice selected={!inclusive} onClick={() => setInclusive(false)} title="VAT-exclusive" desc={`VAT is added on top (+${vatRatePercent}%)`} />
              <Choice selected={inclusive} onClick={() => setInclusive(true)} title="VAT-inclusive" desc="Prices already include VAT" />
            </div>
          </div>
        </>
      )}

      <FieldError>{error}</FieldError>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          <Save className="size-4" strokeWidth={2} aria-hidden /> Save invoicing
        </Button>
      </div>
    </div>
  );
}

function Choice({ selected, onClick, title, desc }: { selected: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-control border p-3 text-left transition-colors",
        selected ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <div className="text-[13px] font-medium text-text">{title}</div>
      <div className="mt-0.5 text-[11.5px] text-text-3">{desc}</div>
    </button>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}
