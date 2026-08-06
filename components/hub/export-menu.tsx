"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { exportCsv, exportExcel, exportPdf, type ExportTable } from "@/lib/export/table-export";

export type ExportFormat = "csv" | "excel" | "pdf";

/**
 * Feedback #9 — the Export dropdown (CSV / Excel / PDF). The file is built
 * client-side from the rows already on screen; `onExported` runs the server
 * audit (client PII exports are pii.export, fail-strict).
 */
export function ExportMenu({ table, onExported }: {
  table: ExportTable;
  onExported?: (format: ExportFormat) => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  // Portaled to <body>: the page's entrance animations create stacking contexts
  // that a nested z-index can't cross, so the menu anchors to the button rect.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && menuRef.current && !menuRef.current.contains(t)) setOpen(false);
    };
    const onAway = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onAway, true);
    window.addEventListener("resize", onAway);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onAway, true);
      window.removeEventListener("resize", onAway);
    };
  }, [open]);

  const run = (format: ExportFormat) => {
    setOpen(false);
    if (table.rows.length === 0) return toast({ tone: "default", title: "Nothing to export", description: "The list is empty." });
    if (format === "csv") exportCsv(table);
    else if (format === "excel") exportExcel(table);
    else exportPdf(table);
    void onExported?.(format);
    if (format !== "pdf") toast({ tone: "success", title: `Exported ${table.rows.length} row${table.rows.length === 1 ? "" : "s"}`, description: `${table.filenameBase}.${format === "excel" ? "xls" : "csv"}` });
  };

  const Item = ({ format, icon: Icon, label, hint }: { format: ExportFormat; icon: typeof FileText; label: string; hint: string }) => (
    <button
      type="button"
      onClick={() => run(format)}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
    >
      <Icon className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-text">{label}</span>
        <span className="block text-[11px] text-text-3">{hint}</span>
      </span>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        <Download className="size-4" strokeWidth={2} aria-hidden /> Export
        <ChevronDown className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />
      </Button>
      {open && anchor && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Export format"
          style={{ top: anchor.top, right: anchor.right }}
          className="pop fixed z-[70] w-52 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-[var(--shadow-card)]"
        >
          <Item format="csv" icon={FileText} label="CSV" hint="Comma-separated · any tool" />
          <Item format="excel" icon={FileSpreadsheet} label="Excel" hint="Opens in Microsoft Excel" />
          <Item format="pdf" icon={Printer} label="PDF" hint="Print-ready document" />
        </div>,
        document.body,
      )}
    </div>
  );
}
