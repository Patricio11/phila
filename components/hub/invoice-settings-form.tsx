"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import Link from "next/link";
import type { InvoiceSettings } from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveInvoiceSettings } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

export function InvoiceSettingsForm({
  initial,
  vatRatePercent,
  paymentsEnabled,
}: {
  initial: InvoiceSettings;
  vatRatePercent: number;
  paymentsEnabled: boolean;
}) {
  const { toast } = useToast();
  const [s, setS] = useState<InvoiceSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<InvoiceSettings>) => setS((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await saveInvoiceSettings({
      vatRegistered: s.vatRegistered,
      vatNumber: s.vatNumber,
      pricesIncludeVat: s.pricesIncludeVat,
      invoicePrefix: s.invoicePrefix,
      paymentTermsDays: s.paymentTermsDays,
      bankName: s.bankName,
      accountName: s.accountName,
      accountNumber: s.accountNumber,
      branchCode: s.branchCode,
      showPayButton: s.showPayButton,
    });
    setSaving(false);
    if (res.ok) toast({ tone: "success", title: "Invoicing saved", description: "New invoices use these settings." });
    else setError(res.error);
  };

  return (
    <div className="space-y-6">
      {/* VAT */}
      <Section title="VAT">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13.5px] font-medium text-text">VAT registered</div>
            <div className="mt-0.5 text-[12px] text-text-2">Turn on if your practice is a registered VAT vendor. The rate ({vatRatePercent}%) is set nationally by the platform.</div>
          </div>
          <Toggle on={s.vatRegistered} onClick={() => set({ vatRegistered: !s.vatRegistered })} />
        </div>
        {s.vatRegistered && (
          <>
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="vat-number">VAT number</Label>
              <Input id="vat-number" value={s.vatNumber} onChange={(e) => set({ vatNumber: e.target.value })} placeholder="e.g. 4512345678" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Your service prices are</Label>
              <div className="grid max-w-md grid-cols-2 gap-2">
                <Choice selected={!s.pricesIncludeVat} onClick={() => set({ pricesIncludeVat: false })} title="VAT-exclusive" desc={`VAT is added on top (+${vatRatePercent}%)`} />
                <Choice selected={s.pricesIncludeVat} onClick={() => set({ pricesIncludeVat: true })} title="VAT-inclusive" desc="Prices already include VAT" />
              </div>
            </div>
          </>
        )}
      </Section>

      {/* Numbering */}
      <Section title="Numbering & terms">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prefix">Invoice prefix</Label>
            <Input id="prefix" value={s.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value.toUpperCase() })} placeholder="MZ" className="max-w-[140px]" />
            <p className="text-[11.5px] text-text-3">Numbers read <span className="font-medium text-text-2">{s.invoicePrefix || "INV"}-2026-0149</span>.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="terms">Payment terms</Label>
            <div className="flex items-center gap-1.5">
              <Input id="terms" type="number" min={0} max={180} value={s.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: Number(e.target.value || 0) })} className="w-24" />
              <span className="text-[12.5px] text-text-3">days to pay</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Banking */}
      <Section title="Banking details (EFT)">
        <p className="text-[12px] text-text-2">Printed on invoices so clients can pay by EFT. Leave blank to omit.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bank" value={s.bankName} onChange={(v) => set({ bankName: v })} placeholder="First National Bank" />
          <Field label="Account name" value={s.accountName} onChange={(v) => set({ accountName: v })} placeholder="Your practice" />
          <Field label="Account number" value={s.accountNumber} onChange={(v) => set({ accountNumber: v.replace(/\D/g, "") })} placeholder="62845109973" inputMode="numeric" />
          <Field label="Branch code" value={s.branchCode} onChange={(v) => set({ branchCode: v.replace(/\D/g, "") })} placeholder="250655" inputMode="numeric" />
        </div>
      </Section>

      {/* Pay button */}
      <Section title="Online payment">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13.5px] font-medium text-text">Show a “Pay now” button on invoices</div>
            <div className="mt-0.5 text-[12px] text-text-2">
              Clients pay through your connected gateway straight from the invoice.{" "}
              {!paymentsEnabled && <>Connect a gateway under <Link href="/hub/settings" className="font-medium text-accent hover:underline">Payments</Link> first.</>}
            </div>
          </div>
          <Toggle on={s.showPayButton} onClick={() => set({ showPayButton: !s.showPayButton })} disabled={!paymentsEnabled} />
        </div>
        {s.showPayButton && !paymentsEnabled && (
          <p className="text-[12px] font-medium text-warn">Your payment gateway isn&apos;t connected yet — the button stays hidden until it is.</p>
        )}
      </Section>

      <FieldError>{error}</FieldError>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          <Save className="size-4" strokeWidth={2} aria-hidden /> Save invoicing
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "numeric" }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} />
    </div>
  );
}

function Choice({ selected, onClick, title, desc }: { selected: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("rounded-control border p-3 text-left transition-colors", selected ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover")}>
      <div className="text-[13px] font-medium text-text">{title}</div>
      <div className="mt-0.5 text-[11.5px] text-text-3">{desc}</div>
    </button>
  );
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40", on && !disabled ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}
