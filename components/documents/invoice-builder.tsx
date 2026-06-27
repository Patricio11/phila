"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Printer, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface LineItem {
  id: number;
  description: string;
  qty: number;
  unitCents: number;
}

const VAT_RATE = 0.15;

function rands(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

/**
 * The A4 invoice builder (DESIGN.md §6 DocumentSheet / Task 7.4) — type directly
 * on a real document: borderless fields, live totals, a thin toolbar, and a clean
 * print stylesheet (`.print-area`). Fully responsive: fills a phone, scrolls.
 */
export function InvoiceBuilder({
  orgName,
  province,
  clients,
  services,
  invoiceNumber,
  backHref,
}: {
  orgName: string;
  province: string;
  clients: { id: string; name: string }[];
  services: { id: string; name: string; priceCents: number | null }[];
  invoiceNumber: string;
  backHref: string;
}) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState<string | null>(clients[0]?.id ?? null);
  const [items, setItems] = useState<LineItem[]>([{ id: 1, description: "Individual counselling", qty: 1, unitCents: 45000 }]);
  const [seq, setSeq] = useState(2);

  const clientName = clients.find((c) => c.id === clientId)?.name ?? "—";
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitCents, 0);
  const vat = Math.round(subtotal * VAT_RATE);
  const total = subtotal + vat;

  const addFromService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setItems((prev) => [...prev, { id: seq, description: svc.name, qty: 1, unitCents: svc.priceCents ?? 0 }]);
    setSeq((n) => n + 1);
  };
  const update = (id: number, patch: Partial<LineItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}><ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back</Link>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-44">
            <Select value={null} onChange={addFromService} placeholder="Add a service…" options={services.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" strokeWidth={2} aria-hidden /> Print
          </Button>
          <Button size="sm" onClick={() => toast({ tone: "success", title: "Invoice sent", description: `${clientName} will receive it by email.` })}>
            <Send className="size-4" strokeWidth={2} aria-hidden /> Send
          </Button>
        </div>
      </div>

      {/* A4 sheet */}
      <div className="a4-sheet print-area p-8 sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[20px] font-[720] tracking-[-0.02em]">{orgName}</div>
            <div className="mt-0.5 text-[12px] text-[#5b635e]">{province}, South Africa</div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-[700] tracking-[-0.02em] text-[#1C7D58]">TAX INVOICE</div>
            <div className="mt-1 text-[12px] text-[#5b635e]">{invoiceNumber}</div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-6">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8b938e]">Bill to</div>
            <div className="no-print mt-1 w-56">
              <Select value={clientId} onChange={setClientId} options={clients.map((c) => ({ value: c.id, label: c.name }))} />
            </div>
            <div className="mt-1 hidden text-[14px] font-medium print:block">{clientName}</div>
          </div>
          <div className="text-right text-[12px] text-[#5b635e]">
            <div>Issued: {new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}</div>
            <div className="mt-0.5">Due in 14 days</div>
          </div>
        </div>

        {/* Line items */}
        <table className="mt-8 w-full text-[13px]">
          <thead>
            <tr className="border-b-2 border-[#141916] text-left text-[11px] uppercase tracking-wide text-[#5b635e]">
              <th className="pb-2 font-semibold">Description</th>
              <th className="w-16 pb-2 text-right font-semibold">Qty</th>
              <th className="w-28 pb-2 text-right font-semibold">Unit</th>
              <th className="w-28 pb-2 text-right font-semibold">Amount</th>
              <th className="no-print w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-[#e5e9e7]">
                <td className="py-2">
                  <input value={i.description} onChange={(e) => update(i.id, { description: e.target.value })} className="w-full rounded bg-transparent px-1 py-0.5 outline-none focus:bg-[#f1f4f2]" />
                </td>
                <td className="py-2 text-right">
                  <input value={String(i.qty)} onChange={(e) => update(i.id, { qty: Number(e.target.value.replace(/\D/g, "") || 0) })} className="w-12 rounded bg-transparent px-1 py-0.5 text-right tabular-nums outline-none focus:bg-[#f1f4f2]" />
                </td>
                <td className="py-2 text-right">
                  <input value={String(Math.round(i.unitCents / 100))} onChange={(e) => update(i.id, { unitCents: Number(e.target.value.replace(/\D/g, "") || 0) * 100 })} className="w-20 rounded bg-transparent px-1 py-0.5 text-right tabular-nums outline-none focus:bg-[#f1f4f2]" />
                </td>
                <td className="py-2 text-right tabular-nums">{rands(i.qty * i.unitCents)}</td>
                <td className="no-print py-2 text-right">
                  <button type="button" onClick={() => remove(i.id)} aria-label="Remove line" className="text-[#8b938e] hover:text-[#C2554D]"><Trash2 className="size-4" aria-hidden /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button type="button" onClick={() => { setItems((p) => [...p, { id: seq, description: "", qty: 1, unitCents: 0 }]); setSeq((n) => n + 1); }} className="no-print mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#1C7D58]">
          <Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add line
        </button>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1.5 text-[13px]">
            <Row label="Subtotal" value={rands(subtotal)} />
            <Row label="VAT (15%)" value={rands(vat)} />
            <div className="flex items-center justify-between border-t-2 border-[#141916] pt-2 text-[15px] font-bold">
              <span>Total</span>
              <span className="tabular-nums">{rands(total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-10 text-[11px] text-[#8b938e]">
          Thank you. Payment via your practice&apos;s preferred method. This is a system-generated tax invoice.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#5b635e]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
