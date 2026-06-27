"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Check, FilePlus2 } from "lucide-react";
import type { Invoice } from "@/lib/mock/types";
import type { PaymentStatus } from "@/lib/domain/enums";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { markInvoicePaid, sendInvoiceReminder } from "@/app/hub/invoicing/actions";
import { InvoicePreview } from "@/components/hub/invoice-preview";
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

export function InvoiceBoard({ rows, nowISO, orgName, province }: { rows: InvoiceRow[]; nowISO: string; orgName: string; province: string }) {
  const { toast } = useToast();
  const nowMs = new Date(nowISO).getTime();
  const [statusOf, setStatusOf] = useState<Record<string, PaymentStatus>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoiceRow | null>(null);
  const [, start] = useTransition();

  const effective = (r: InvoiceRow): PaymentStatus => statusOf[r.invoice.id] ?? r.invoice.status;
  const isOverdue = (r: InvoiceRow) => effective(r) === "unpaid" && new Date(r.invoice.dueAt).getTime() < nowMs;

  const view = rows.map((r) => ({ ...r, _status: effective(r) }));
  const outstanding = view.filter((r) => r._status === "unpaid").reduce((s, r) => s + r.invoice.amountCents, 0);
  const paid = view.filter((r) => r._status === "paid").reduce((s, r) => s + r.invoice.amountCents, 0);
  const overdue = view.filter((r) => r._status === "unpaid" && new Date(r.invoice.dueAt).getTime() < nowMs);
  const overdueTotal = overdue.reduce((s, r) => s + r.invoice.amountCents, 0);

  const markPaid = (r: InvoiceRow) => {
    setPendingId(r.invoice.id);
    start(async () => {
      const res = await markInvoicePaid({ invoiceId: r.invoice.id });
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setStatusOf((prev) => ({ ...prev, [r.invoice.id]: "paid" }));
      toast({ tone: "success", title: `${r.invoice.number} marked paid`, description: `${rands(r.invoice.amountCents)} reconciled for ${r.clientName.split(" ")[0]}.` });
    });
  };

  const remind = (r: InvoiceRow) => {
    setPendingId(r.invoice.id);
    start(async () => {
      const res = await sendInvoiceReminder({ invoiceId: r.invoice.id });
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "default", title: `Reminder queued for ${r.clientName.split(" ")[0]}`, description: "It goes out by WhatsApp + email once messaging is connected." });
    });
  };

  const columns: Column<InvoiceRow>[] = [
    { key: "number", header: "Invoice", sortValue: (r) => r.invoice.number, render: (r) => <button type="button" onClick={() => setPreview(r)} className="font-medium tabular-nums text-text hover:text-accent hover:underline">{r.invoice.number}</button> },
    { key: "client", header: "Client", sortValue: (r) => r.clientName, render: (r) => <span className="text-text-2">{r.clientName}</span> },
    { key: "service", header: "Service", hideBelow: "md", render: (r) => <span className="text-text-3">{r.invoice.serviceName}</span> },
    {
      key: "due",
      header: "Due",
      hideBelow: "lg",
      sortValue: (r) => r.invoice.dueAt,
      render: (r) => (
        <span className={cn("tabular-nums", isOverdue(r) ? "font-semibold text-danger" : "text-text-3")}>
          {shortDate(r.invoice.dueAt)}{isOverdue(r) ? " · overdue" : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => effective(r),
      render: (r) => <span className={cn("inline-flex rounded-chip px-2 py-0.5 text-[11.5px] font-semibold", STATUS[effective(r)].cls)}>{STATUS[effective(r)].label}</span>,
    },
    { key: "amount", header: "Amount", align: "right", sortValue: (r) => r.invoice.amountCents, render: (r) => <span className="font-semibold tabular-nums text-text">{rands(r.invoice.amountCents)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        effective(r) === "unpaid" ? (
          <div className="flex justify-end gap-1.5">
            <Button variant="mini" disabled={pendingId === r.invoice.id} onClick={() => remind(r)}>
              <BellRing className="size-3.5" strokeWidth={2} aria-hidden /> Remind
            </Button>
            <Button variant="mini" disabled={pendingId === r.invoice.id} onClick={() => markPaid(r)}>
              <Check className="size-3.5" strokeWidth={2.2} aria-hidden /> Mark paid
            </Button>
          </div>
        ) : (
          <span className="text-[12px] text-text-3"></span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3 sm:max-w-2xl">
        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="text-[22px] font-bold tabular-nums text-warn">{rands(outstanding)}</div>
          <div className="text-[12px] text-text-2">Outstanding</div>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className={cn("text-[22px] font-bold tabular-nums", overdueTotal > 0 ? "text-danger" : "text-text-3")}>{rands(overdueTotal)}</div>
          <div className="text-[12px] text-text-2">{overdue.length} overdue</div>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="text-[22px] font-bold tabular-nums text-accent">{rands(paid)}</div>
          <div className="text-[12px] text-text-2">Paid</div>
        </div>
      </div>

      <DataTable
        rows={view}
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

      {preview && (
        <InvoicePreview
          invoice={preview.invoice}
          clientName={preview.clientName}
          orgName={orgName}
          province={province}
          status={effective(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
