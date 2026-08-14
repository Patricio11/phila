"use client";

import { useState, useTransition } from "react";
import { za } from "@/lib/format";
import Link from "next/link";
import { BellRing, Check, Eye, FilePlus2, Link2, Pencil, RotateCcw, XCircle } from "lucide-react";
import type { Invoice } from "@/lib/domain/types";
import type { PaymentStatus } from "@/lib/domain/enums";
import type { InvoiceSettings } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getInvoicePayLink, markInvoicePaid, sendInvoiceReminder, updateInvoice, setInvoiceCancelled } from "@/app/hub/invoicing/actions";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useRouter } from "next/navigation";
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
  return `R${za((cents / 100))}`;
}
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
}

export function InvoiceBoard({ rows, nowISO, orgName, province, vatRatePercent, settings, paymentsEnabled }: { rows: InvoiceRow[]; nowISO: string; orgName: string; province: string; vatRatePercent: number; settings: InvoiceSettings; paymentsEnabled: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const nowMs = new Date(nowISO).getTime();
  const [statusOf, setStatusOf] = useState<Record<string, PaymentStatus>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoiceRow | null>(null);
  const [, start] = useTransition();
  // Batch 3k - the board grows up: status tabs, and per-row edit / cancel.
  const [tab, setTab] = useState<"all" | "unpaid" | "overdue" | "paid" | "cancelled">("all");
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [eService, setEService] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eDue, setEDue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const effective = (r: InvoiceRow): PaymentStatus => statusOf[r.invoice.id] ?? r.invoice.status;
  const isOverdue = (r: InvoiceRow) => effective(r) === "unpaid" && new Date(r.invoice.dueAt).getTime() < nowMs;

  const all = rows.map((r) => ({ ...r, _status: effective(r) }));
  const counts = {
    all: all.length,
    unpaid: all.filter((r) => r._status === "unpaid").length,
    overdue: all.filter((r) => r._status === "unpaid" && new Date(r.invoice.dueAt).getTime() < nowMs).length,
    paid: all.filter((r) => r._status === "paid").length,
    cancelled: all.filter((r) => r._status === "cancelled").length,
  };
  const view = all.filter((r) =>
    tab === "all" ? true
    : tab === "overdue" ? r._status === "unpaid" && new Date(r.invoice.dueAt).getTime() < nowMs
    : r._status === tab);
  const outstanding = all.filter((r) => r._status === "unpaid").reduce((s, r) => s + r.invoice.amountCents, 0);
  const paid = all.filter((r) => r._status === "paid").reduce((s, r) => s + r.invoice.amountCents, 0);
  const overdue = all.filter((r) => r._status === "unpaid" && new Date(r.invoice.dueAt).getTime() < nowMs);
  const overdueTotal = overdue.reduce((s, r) => s + r.invoice.amountCents, 0);

  const openEdit = (r: InvoiceRow) => {
    setEService(r.invoice.serviceName);
    setEAmount(String(Math.round(r.invoice.amountCents / 100)));
    setEDue(r.invoice.dueAt.slice(0, 10));
    setEditing(r);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const res = await updateInvoice({ invoiceId: editing.invoice.id, serviceName: eService.trim(), amountRands: Number(eAmount || 0), dueAt: eDue });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `${editing.invoice.number} updated`, description: "The client sees the new details on their invoice." });
      setEditing(null);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  };

  const cancelInvoice = (r: InvoiceRow, cancelled: boolean) => {
    setPendingId(r.invoice.id);
    start(async () => {
      const res = await setInvoiceCancelled({ invoiceId: r.invoice.id, cancelled });
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setStatusOf((prev) => ({ ...prev, [r.invoice.id]: cancelled ? "cancelled" : "unpaid" }));
      toast({
        tone: "success",
        title: cancelled ? `${r.invoice.number} cancelled` : `${r.invoice.number} reinstated`,
        description: cancelled ? "It stays on the books, struck through - reinstate any time." : "Back on the unpaid list.",
      });
    });
  };

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

  const copyPayLink = (r: InvoiceRow) => {
    setPendingId(r.invoice.id);
    start(async () => {
      const res = await getInvoicePayLink({ invoiceId: r.invoice.id });
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      try { await navigator.clipboard.writeText(res.url); } catch { /* clipboard blocked */ }
      toast({ tone: "success", title: "Pay link copied", description: `Share it with ${r.clientName.split(" ")[0]}  they pay you directly.` });
    });
  };

  const remind = (r: InvoiceRow) => {
    setPendingId(r.invoice.id);
    start(async () => {
      const res = await sendInvoiceReminder({ invoiceId: r.invoice.id });
      setPendingId(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({
        tone: "success",
        title: `Reminder sent to ${r.clientName.split(" ")[0]}`,
        description: res.emailed ? "By email + in their portal." : "In their portal (no email on file).",
      });
    });
  };

  const columns: Column<InvoiceRow>[] = [
    { key: "number", header: "Invoice", sortValue: (r) => r.invoice.number, render: (r) => <button type="button" onClick={() => setPreview(r)} className="font-medium tabular-nums text-text hover:text-accent hover:underline">{r.invoice.number}</button> },
    { key: "client", header: "Client", sortValue: (r) => r.clientName, render: (r) => (
      <span className="flex items-center gap-2"><Avatar name={r.clientName} size="sm" /><span className="text-text-2">{r.clientName}</span></span>
    ) },
    { key: "service", header: "Service", hideBelow: "md", render: (r) => <span className="text-text-3">{r.invoice.serviceName}</span> },
    { key: "issued", header: "Issued", hideBelow: "lg", sortValue: (r) => r.invoice.issuedAt, render: (r) => <span className="tabular-nums text-text-3">{shortDate(r.invoice.issuedAt)}</span> },
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
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {effective(r) === "unpaid" && (
            <Button variant="mini" disabled={pendingId === r.invoice.id} onClick={() => markPaid(r)}>
              <Check className="size-3.5" strokeWidth={2.2} aria-hidden /> Mark paid
            </Button>
          )}
          <KebabMenu
            label={`Options for ${r.invoice.number}`}
            items={[
              { label: "View invoice", icon: Eye, onClick: () => setPreview(r) },
              ...(effective(r) === "unpaid"
                ? [
                    { label: "Edit", icon: Pencil, onClick: () => openEdit(r) },
                    ...(paymentsEnabled ? [{ label: "Copy pay link", icon: Link2, onClick: () => copyPayLink(r) }] : []),
                    { label: "Send reminder", icon: BellRing, onClick: () => remind(r) },
                    { label: "Cancel invoice", icon: XCircle, onClick: () => cancelInvoice(r, true), danger: true },
                  ]
                : []),
              ...(effective(r) === "cancelled"
                ? [{ label: "Reinstate", icon: RotateCcw, onClick: () => cancelInvoice(r, false) }]
                : []),
            ]}
          />
        </div>
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

      {/* The book, by state - like every other board. */}
      <div className="flex flex-wrap gap-1.5">
        {([
          { key: "all" as const, label: "All" },
          { key: "unpaid" as const, label: "Unpaid" },
          { key: "overdue" as const, label: "Overdue" },
          { key: "paid" as const, label: "Paid" },
          { key: "cancelled" as const, label: "Cancelled" },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.key ? "border-accent bg-accent text-accent-ink" : "border-border bg-surface hover:bg-surface-hover",
              tab !== t.key && (t.key === "overdue" && counts.overdue > 0 ? "text-danger" : "text-text-2"),
            )}
          >
            {t.label}
            <span className={cn("tabular-nums", tab === t.key ? "text-accent-ink/75" : "text-text-3")}>{counts[t.key]}</span>
          </button>
        ))}
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

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.invoice.number}` : "Edit invoice"}
        description={editing ? `${editing.clientName} - unpaid, so the details may still change.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</Button>
            <Button size="sm" onClick={() => void saveEdit()} loading={savingEdit} disabled={eService.trim().length < 2 || !(Number(eAmount) >= 0) || !eDue}>Save changes</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Service</Label>
            <Input aria-label="Service name" value={eService} onChange={(e) => setEService(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (R)</Label>
              <Input aria-label="Amount in rands" inputMode="numeric" value={eAmount} onChange={(e) => setEAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <DatePicker value={eDue} onChange={setEDue} ariaLabel="Due date" />
            </div>
          </div>
        </div>
      </Dialog>

      {preview && (
        <InvoicePreview
          invoice={preview.invoice}
          clientName={preview.clientName}
          orgName={orgName}
          province={province}
          status={effective(preview)}
          vatRatePercent={vatRatePercent}
          settings={settings}
          paymentsEnabled={paymentsEnabled}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
