"use client";

import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import type { Invoice } from "@/lib/mock/types";
import type { PaymentStatus } from "@/lib/domain/enums";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InvoiceRow {
  invoice: Invoice;
  clientName: string;
}

const STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-accent-soft text-accent" },
  unpaid: { label: "Unpaid", cls: "bg-warn-soft text-warn" },
  cancelled: { label: "Cancelled", cls: "bg-surface-2 text-text-3" },
  refunded: { label: "Refunded", cls: "bg-info-soft text-info" },
};

function rands(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
}

export function InvoiceBoard({ rows }: { rows: InvoiceRow[] }) {
  const outstanding = rows.filter((r) => r.invoice.status === "unpaid").reduce((s, r) => s + r.invoice.amountCents, 0);
  const paid = rows.filter((r) => r.invoice.status === "paid").reduce((s, r) => s + r.invoice.amountCents, 0);

  const columns: Column<InvoiceRow>[] = [
    {
      key: "number",
      header: "Invoice",
      sortValue: (r) => r.invoice.number,
      render: (r) => <span className="font-medium tabular-nums text-text">{r.invoice.number}</span>,
    },
    {
      key: "client",
      header: "Client",
      sortValue: (r) => r.clientName,
      render: (r) => <span className="text-text-2">{r.clientName}</span>,
    },
    {
      key: "service",
      header: "Service",
      hideBelow: "md",
      render: (r) => <span className="text-text-3">{r.invoice.serviceName}</span>,
    },
    {
      key: "due",
      header: "Due",
      hideBelow: "lg",
      sortValue: (r) => r.invoice.dueAt,
      render: (r) => <span className="text-text-3">{shortDate(r.invoice.dueAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.invoice.status,
      render: (r) => (
        <span className={cn("inline-flex rounded-chip px-2 py-0.5 text-[11.5px] font-semibold", STATUS[r.invoice.status].cls)}>
          {STATUS[r.invoice.status].label}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (r) => r.invoice.amountCents,
      render: (r) => <span className="font-semibold tabular-nums text-text">{rands(r.invoice.amountCents)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 sm:max-w-md">
        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="text-[22px] font-bold tabular-nums text-warn">{rands(outstanding)}</div>
          <div className="text-[12px] text-text-2">Outstanding</div>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="text-[22px] font-bold tabular-nums text-accent">{rands(paid)}</div>
          <div className="text-[12px] text-text-2">Paid</div>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.invoice.id}
        search={{ placeholder: "Search invoices…", getText: (r) => `${r.invoice.number} ${r.clientName} ${r.invoice.serviceName}` }}
        toolbar={
          <Button asChild size="sm" className="ml-auto">
            <Link href="/hub/invoicing/new">
              <FilePlus2 className="size-4" strokeWidth={2} aria-hidden /> Create invoice
            </Link>
          </Button>
        }
      />
    </div>
  );
}
