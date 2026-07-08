"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** A slim print bar for the standalone report pack — hidden when printing. */
export function PrintReportBar({ backHref }: { backHref: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur print:hidden">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back to grant
      </Link>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="size-4" strokeWidth={2} aria-hidden /> Print / Save as PDF
      </Button>
    </div>
  );
}
