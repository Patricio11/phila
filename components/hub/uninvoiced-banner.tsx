"use client";

import { useState, useTransition } from "react";
import { za } from "@/lib/format";
import { useRouter } from "next/navigation";
import { ChevronDown, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { backfillInvoices } from "@/app/hub/invoicing/actions";
import { NoticeDismiss, useNoticeDismissed } from "@/components/ui/notice-dismiss";
import { cn } from "@/lib/utils";

function day(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short" }).format(new Date(iso));
}

/**
 * Feedback batch 2 - billing never slips: completed sessions that never got an
 * invoice surface here with one-click generation for all of them.
 */
export function UninvoicedBanner({ rows }: { rows: { appointmentId: string; clientName: string; serviceName: string; startsAt: string; priceCents: number }[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [dismissed, dismiss] = useNoticeDismissed("uninvoiced");
  if (rows.length === 0 || dismissed) return null;

  const totalR = Math.round(rows.reduce((s, r) => s + r.priceCents, 0) / 100);

  const run = () =>
    start(async () => {
      const res = await backfillInvoices();
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({
        tone: "success",
        title: `${res.created} invoice${res.created === 1 ? "" : "s"} raised`,
        description: res.skipped > 0 ? `${res.skipped} skipped (waived fees or already invoiced).` : "They're on the board below, unpaid until reconciled.",
      });
      router.refresh();
    });

  return (
    <div className="rounded-card border border-warn/40 bg-warn-soft/40">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
        <Receipt className="size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden />
        <p className="min-w-0 flex-1 text-[13px] text-text">
          <span className="font-semibold">{rows.length} completed session{rows.length === 1 ? "" : "s"}</span> ha{rows.length === 1 ? "s" : "ve"} no
          invoice - about <span className="font-semibold tabular-nums">R{za(totalR)}</span> unbilled.
        </p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-text-2 hover:text-text">
          {open ? "Hide" : "Review"} <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} strokeWidth={2} aria-hidden />
        </button>
        <Button size="sm" onClick={run} loading={pending}>Generate {rows.length === 1 ? "invoice" : `${rows.length} invoices`}</Button>
        <NoticeDismiss onDismiss={dismiss} />
      </div>
      {open && (
        <ul className="max-h-56 overflow-y-auto border-t border-warn/30 px-4 py-2.5">
          {rows.map((r) => (
            <li key={r.appointmentId} className="flex items-center gap-2 py-1 text-[12.5px]">
              <span className="w-14 shrink-0 tabular-nums text-text-3">{day(r.startsAt)}</span>
              <span className="min-w-0 flex-1 truncate text-text-2">{r.clientName}</span>
              <span className="hidden shrink-0 text-text-3 sm:inline">{r.serviceName}</span>
              <span className="shrink-0 tabular-nums text-text">R{za(Math.round(r.priceCents / 100))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
