"use client";

import { Printer, X } from "lucide-react";
import type { Invoice } from "@/lib/domain/types";
import type { PaymentStatus } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { computeVat } from "@/lib/domain/helpers";
import { cn } from "@/lib/utils";

const STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "PAID", cls: "text-[#1C7D58] border-[#1C7D58]" },
  unpaid: { label: "UNPAID", cls: "text-[#9a6418] border-[#9a6418]" },
  cancelled: { label: "CANCELLED", cls: "text-[#8b938e] border-[#8b938e]" },
  refunded: { label: "REFUNDED", cls: "text-[#3C7FB0] border-[#3C7FB0]" },
};

function rands(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}
function fullDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/** Read-only A4 preview of an existing invoice, print-isolated (`.print-area`). */
export function InvoicePreview({
  invoice,
  clientName,
  orgName,
  province,
  status,
  vatRatePercent,
  vatRegistered,
  vatNumber,
  onClose,
}: {
  invoice: Invoice;
  clientName: string;
  orgName: string;
  province: string;
  status: PaymentStatus;
  vatRatePercent: number;
  vatRegistered: boolean;
  vatNumber: string;
  onClose: () => void;
}) {
  // The stored amount is the gross total; decompose it for a registered vendor.
  const { exVatCents, vatCents, totalCents } = computeVat({ amountCents: invoice.amountCents, vatRatePercent, vatRegistered, pricesIncludeVat: true });
  const s = STATUS[status];

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div className="mx-auto w-full max-w-[820px]" onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="no-print mb-3 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" strokeWidth={2} aria-hidden /> Print / Download
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" strokeWidth={2} aria-hidden /> Close
          </Button>
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
              <div className="mt-1 text-[12px] text-[#5b635e]">{invoice.number}</div>
              <div className={cn("mt-2 inline-block rounded border px-2 py-0.5 text-[11px] font-bold tracking-wide", s.cls)}>{s.label}</div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-between gap-6">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8b938e]">Bill to</div>
              <div className="mt-1 text-[14px] font-medium">{clientName}</div>
            </div>
            <div className="text-right text-[12px] text-[#5b635e]">
              <div>Issued: {fullDate(invoice.issuedAt)}</div>
              <div className="mt-0.5">Due: {fullDate(invoice.dueAt)}</div>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[460px] text-[13px]">
              <thead>
                <tr className="border-b-2 border-[#141916] text-left text-[11px] uppercase tracking-wide text-[#5b635e]">
                  <th className="pb-2 font-semibold">Description</th>
                  <th className="w-16 pb-2 text-right font-semibold">Qty</th>
                  <th className="w-32 pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#e5e9e7]">
                  <td className="py-2.5">{invoice.serviceName}</td>
                  <td className="py-2.5 text-right tabular-nums">1</td>
                  <td className="py-2.5 text-right tabular-nums">{rands(exVatCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>

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

          <p className="mt-10 text-[11px] text-[#8b938e]">
            Thank you. Payment via your practice&apos;s preferred method (PayShap / EFT). This is a system-generated {vatRegistered ? "tax invoice" : "invoice"}.
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
