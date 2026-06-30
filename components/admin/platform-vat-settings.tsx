"use client";

import { useState } from "react";
import { Percent, Save } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { savePlatformVat } from "@/app/admin/settings/actions";

/**
 * The national VAT rate  one setting, applied to every org's invoices and
 * reporting. Changing it here is the single lever for a national rate change.
 */
export function PlatformVatSettings({ initialRate }: { initialRate: number }) {
  const { toast } = useToast();
  const [rate, setRate] = useState(String(initialRate));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await savePlatformVat({ vatRatePercent: Number(rate) });
    setSaving(false);
    if (res.ok) toast({ tone: "success", title: "VAT rate updated", description: "Every org's invoices and reporting use this rate." });
    else setError(res.error);
  };

  return (
    <Card>
      <CardHead title="VAT rate (national)" />
      <div className="space-y-3 px-[17px] pb-[17px]">
        <p className="text-[12.5px] text-text-2">
          The South African VAT rate. It applies to every VAT-registered org on the platform  change it once here and all invoices follow.
        </p>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vat-rate">Rate</Label>
            <div className="relative w-32">
              <Input id="vat-rate" type="number" min={0} max={28} step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} className="pr-9" />
              <Percent className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
            </div>
          </div>
          <Button onClick={save} loading={saving}>
            <Save className="size-4" strokeWidth={2} aria-hidden /> Save
          </Button>
        </div>
        <FieldError>{error}</FieldError>
      </div>
    </Card>
  );
}
