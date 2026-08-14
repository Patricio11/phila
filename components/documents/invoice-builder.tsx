"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CreditCard, Plus, Printer, Save, Trash2 } from "lucide-react";
import type { InvoiceSettings } from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { useToast } from "@/components/ui/toast";
import { computeVat } from "@/lib/domain/helpers";
import { appointmentReference } from "@/lib/scheduling/reference";
import { createInvoice } from "@/app/hub/invoicing/actions";

/** Batch 3l - a session the invoice can bill (unbilled, recent or upcoming). */
export interface LinkableSession {
  id: string;
  clientId: string;
  startsAt: string;
  serviceName: string | null;
  counsellorName: string | null;
  billed: boolean;
}

interface LineItem {
  id: number;
  description: string;
  qty: number;
  unitCents: number;
}

function rands(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

/**
 * The A4 invoice builder (DESIGN.md §6 DocumentSheet / Task 7.4)  type directly
 * on a real document: borderless fields, live totals, a thin toolbar, and a clean
 * print stylesheet (`.print-area`). Fully responsive: fills a phone, scrolls.
 * VAT honours the org's registration + the platform's national rate.
 */
export function InvoiceBuilder({
  orgName,
  province,
  clients,
  services,
  invoiceNumber,
  backHref,
  vatRatePercent,
  settings,
  paymentsEnabled,
  linkableSessions = [],
}: {
  orgName: string;
  province: string;
  clients: { id: string; name: string }[];
  services: { id: string; name: string; priceCents: number | null }[];
  invoiceNumber: string;
  backHref: string;
  vatRatePercent: number;
  settings: InvoiceSettings;
  paymentsEnabled: boolean;
  /** Batch 3l - sessions this invoice can bill; linking prints the APT ref on the sheet. */
  linkableSessions?: LinkableSession[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const { vatRegistered, vatNumber, pricesIncludeVat } = settings;
  const [clientId, setClientId] = useState<string | null>(clients[0]?.id ?? null);
  const [items, setItems] = useState<LineItem[]>([{ id: 1, description: "Individual counselling", qty: 1, unitCents: 45000 }]);
  const [seq, setSeq] = useState(2);
  // Batch 3l - the session this invoice bills. Linking one aligns the client
  // and (until lines are hand-edited) the first line to that session's service.
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [itemsTouched, setItemsTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameOf = new Map(clients.map((c) => [c.id, c.name]));
  // Every unbilled session is offered (the label carries the client's name, so
  // search covers it) - picking one aligns the Bill-to client automatically.
  const openSessions = linkableSessions.filter((a) => !a.billed);
  const linked = appointmentId ? linkableSessions.find((a) => a.id === appointmentId) ?? null : null;
  const sessionLabel = (a: LinkableSession) =>
    `${appointmentReference(a.id)} - ${new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(a.startsAt))} - ${nameOf.get(a.clientId) ?? "Client"}${a.serviceName ? ` - ${a.serviceName}` : ""}`;

  const linkSession = (id: string | null) => {
    setAppointmentId(id);
    if (!id) return;
    const a = linkableSessions.find((x) => x.id === id);
    if (!a) return;
    setClientId(a.clientId);
    if (!itemsTouched && a.serviceName) {
      const svc = services.find((sv) => sv.name === a.serviceName);
      setItems([{ id: 1, description: a.serviceName, qty: 1, unitCents: svc?.priceCents ?? 0 }]);
    }
  };

  const save = async () => {
    if (!clientId) return toast({ tone: "error", title: "Choose a client to bill." });
    const description = items.map((i) => i.description.trim()).filter(Boolean).join(" + ").slice(0, 160);
    setSaving(true);
    try {
      const res = await createInvoice({ clientId, appointmentId, serviceName: description, amountRands: totalCents / 100 });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `${res.number} created`, description: linked ? `Billing session ${appointmentReference(linked.id)}.` : "It's on the board as unpaid." });
      router.push(backHref);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";
  const lineSum = items.reduce((s, i) => s + i.qty * i.unitCents, 0);
  const { exVatCents, vatCents, totalCents } = computeVat({ amountCents: lineSum, vatRatePercent, vatRegistered, pricesIncludeVat });
  const showPay = settings.showPayButton && paymentsEnabled;

  const addFromService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setItems((prev) => [...prev, { id: seq, description: svc.name, qty: 1, unitCents: svc.priceCents ?? 0 }]);
    setSeq((n) => n + 1);
  };
  const update = (id: number, patch: Partial<LineItem>) => { setItemsTouched(true); setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i))); };
  const remove = (id: number) => { setItemsTouched(true); setItems((prev) => prev.filter((i) => i.id !== id)); };

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}><ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back</Link>
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {openSessions.length > 0 && (
            <div className="w-64">
              <SearchSelect
                value={appointmentId}
                onChange={linkSession}
                placeholder="Link a session (APT ref)…"
                searchPlaceholder="Search by ref, client or date…"
                ariaLabel="Link a session"
                options={openSessions.map((a) => ({ value: a.id, label: sessionLabel(a) }))}
              />
            </div>
          )}
          <div className="w-44">
            <Select value={null} onChange={addFromService} placeholder="Add a service…" options={services.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" strokeWidth={2} aria-hidden /> Print
          </Button>
          <Button size="sm" onClick={() => void save()} loading={saving} disabled={totalCents <= 0}>
            <Save className="size-4" strokeWidth={2} aria-hidden /> Create invoice
          </Button>
        </div>
      </div>

      {/* A4 sheet */}
      <div className="a4-sheet print-area p-8 sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[20px] font-[720] tracking-[-0.02em]">{orgName}</div>
            <div className="mt-0.5 text-[12px] text-[#5b635e]">{province}, South Africa</div>
            {vatRegistered && vatNumber ? <div className="mt-0.5 text-[12px] text-[#5b635e]">VAT no. {vatNumber}</div> : null}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-[700] tracking-[-0.02em] text-[#1C7D58]">{vatRegistered ? "TAX INVOICE" : "INVOICE"}</div>
            <div className="mt-1 text-[12px] text-[#5b635e]">{invoiceNumber}</div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-6">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8b938e]">Bill to</div>
            <div className="no-print mt-1 w-56">
              <SearchSelect
                avatars
                value={clientId}
                onChange={(v) => { if (v) setClientId(v); }}
                placeholder="Choose a client"
                searchPlaceholder="Search clients…"
                ariaLabel="Bill to"
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="mt-1 hidden text-[14px] font-medium print:block">{clientName}</div>
          </div>
          <div className="text-right text-[12px] text-[#5b635e]">
            <div>Issued: {new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}</div>
            <div className="mt-0.5">Due in {settings.paymentTermsDays} days</div>
            {linked && (
              <div className="mt-0.5">Session ref: <span className="font-mono font-semibold text-[#141916]">{appointmentReference(linked.id)}</span></div>
            )}
          </div>
        </div>

        {linked && (
          <div className="no-print mt-4 flex items-center gap-2 rounded border border-[#e5e9e7] bg-[#f7f9f8] px-3 py-2 text-[12px] text-[#5b635e]">
            <CalendarDays className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span>
              For the session on {new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(linked.startsAt))}
              {linked.counsellorName ? ` with ${linked.counsellorName}` : ""} - ref {appointmentReference(linked.id)}
            </span>
          </div>
        )}

        {/* Line items */}
        <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[460px] text-[13px]">
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
        </div>

        <button type="button" onClick={() => { setItems((p) => [...p, { id: seq, description: "", qty: 1, unitCents: 0 }]); setSeq((n) => n + 1); }} className="no-print mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#1C7D58]">
          <Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add line
        </button>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1.5 text-[13px]">
            {vatRegistered ? (
              <>
                <Row label="Subtotal (excl VAT)" value={rands(exVatCents)} />
                <Row label={`VAT (${vatRatePercent}%)`} value={rands(vatCents)} />
              </>
            ) : null}
            <div className="flex items-center justify-between border-t-2 border-[#141916] pt-2 text-[15px] font-bold">
              <span>Total</span>
              <span className="tabular-nums">{rands(totalCents)}</span>
            </div>
          </div>
        </div>

        {showPay && (
          <div className="no-print mt-6 flex justify-end">
            <button type="button" onClick={() => toast({ tone: "success", title: "Payment", description: `Opens your gateway to pay ${rands(totalCents)}.` })} className="inline-flex h-11 items-center gap-2 rounded-control bg-[#1C7D58] px-5 text-[14px] font-semibold text-white shadow-sm transition-[filter] hover:brightness-95">
              <CreditCard className="size-4" strokeWidth={2} aria-hidden /> Pay {rands(totalCents)} now
            </button>
          </div>
        )}

        <div className="mt-auto pt-8">
        {settings.accountNumber ? (
          <div className="border-t border-[#e5e9e7] pt-4 text-[11.5px] text-[#5b635e]">
            <div className="font-semibold text-[#141916]">Banking details (EFT)</div>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-0.5">
              {settings.bankName && <span>{settings.bankName}</span>}
              {settings.accountName && <span>{settings.accountName}</span>}
              <span>Acc {settings.accountNumber}</span>
              {settings.branchCode && <span>Branch {settings.branchCode}</span>}
              <span>Ref: {invoiceNumber}</span>
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-[11px] text-[#8b938e]">
          Thank you. This is a system-generated {vatRegistered ? "tax invoice" : "invoice"}.
        </p>
        </div>
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
