"use client";

import type { Invoice } from "@/lib/domain/types";
import type { PaymentStatus } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function InvoiceList({ invoices, payEnabled }: { invoices: Invoice[]; payEnabled: boolean }) {
  const { toast } = useToast();

  return (
    <ul className="space-y-2">
      {invoices.map((inv) => {
        const status = STATUS[inv.status];
        return (
          <li key={inv.id} className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-[600] text-text">{inv.serviceName}</span>
                  <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", status.cls)}>
                    {status.label}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-text-3">
                  {inv.number} · issued {dateLabel(inv.issuedAt)}
                  {inv.status === "unpaid" ? ` · due ${dateLabel(inv.dueAt)}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[16px] font-bold tabular-nums text-text">{money(inv.amountCents)}</div>
              </div>
            </div>

            {inv.status === "unpaid" && (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() =>
                    toast(
                      payEnabled
                        ? { tone: "default", title: "Opening secure payment", description: "You'll pay your practice directly." }
                        : {
                            tone: "default",
                            title: "Online payment isn't set up yet",
                            description: "Please pay your practice directly  they'll confirm receipt.",
                          },
                    )
                  }
                >
                  Pay {money(inv.amountCents)}
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
