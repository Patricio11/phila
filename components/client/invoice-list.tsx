"use client";

import { useState } from "react";
import { CreditCard, FileText, Landmark } from "lucide-react";
import type { Invoice } from "@/lib/domain/types";
import type { PaymentStatus } from "@/lib/domain/enums";
import type { InvoiceSettings } from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { InvoicePreview } from "@/components/hub/invoice-preview";
import { cn } from "@/lib/utils";

const STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-accent-soft text-accent" },
  unpaid: { label: "Due", cls: "bg-warn-soft text-warn" },
  cancelled: { label: "Cancelled", cls: "bg-surface-2 text-text-3" },
  refunded: { label: "Refunded", cls: "bg-info-soft text-info" },
};

function money(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 0 })}`;
}
function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function InvoiceList({
  invoices,
  clientName,
  orgName,
  province,
  vatRatePercent,
  settings,
  paymentsEnabled,
}: {
  invoices: Invoice[];
  clientName: string;
  orgName: string;
  province: string;
  vatRatePercent: number;
  settings: InvoiceSettings;
  paymentsEnabled: boolean;
}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Invoice | null>(null);
  const canPayOnline = settings.showPayButton && paymentsEnabled;
  const hasBanking = Boolean(settings.accountNumber);

  return (
    <>
      <ul className="space-y-2">
        {invoices.map((inv) => {
          const status = STATUS[inv.status];
          const unpaid = inv.status === "unpaid";
          return (
            <li key={inv.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-[600] text-text">{inv.serviceName}</span>
                    <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", status.cls)}>{status.label}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-text-3">
                    {inv.number} · issued {dateLabel(inv.issuedAt)}
                    {unpaid ? ` · due ${dateLabel(inv.dueAt)}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[16px] font-bold tabular-nums text-text">{money(inv.amountCents)}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPreview(inv)}>
                  <FileText className="size-4" strokeWidth={2} aria-hidden /> View invoice
                </Button>
                {unpaid && canPayOnline ? (
                  <Button size="sm" onClick={() => toast({ tone: "default", title: "Opening secure payment", description: `You'll pay ${orgName} ${money(inv.amountCents)} directly.` })}>
                    <CreditCard className="size-4" strokeWidth={2} aria-hidden /> Pay {money(inv.amountCents)}
                  </Button>
                ) : unpaid && hasBanking ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
                    <Landmark className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> Pay by EFT  details on the invoice
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {preview && (
        <InvoicePreview
          invoice={preview}
          clientName={clientName}
          orgName={orgName}
          province={province}
          status={preview.status}
          vatRatePercent={vatRatePercent}
          settings={settings}
          paymentsEnabled={paymentsEnabled}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
