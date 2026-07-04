"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Loader2, Upload, UploadCloud } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ColumnMapper } from "@/components/import/column-mapper";
import { CLIENT_IMPORT_FIELDS } from "@/lib/import/schema";
import { parseFile, parseCsv, type ParsedFile } from "@/lib/import/parse";
import { autoMap } from "@/lib/import/automap";
import { buildRows } from "@/lib/import/validate";
import { importClients } from "@/app/hub/clients/actions";
import { cn } from "@/lib/utils";

/**
 * Smart client import — upload a CSV/Excel (or paste), we auto-map the columns, you
 * confirm, we import. No counsellor step: bulk-imported clients land unassigned and
 * the org assigns them from the caseload. Parsing is entirely in the browser.
 */
export function ImportClientsButton({ existingKeys = [] }: { existingKeys?: string[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(() => new Set(existingKeys), [existingKeys]);
  const result = useMemo(
    () => (parsed ? buildRows(CLIENT_IMPORT_FIELDS, parsed, mapping, existing) : null),
    [parsed, mapping, existing],
  );

  const load = (p: ParsedFile) => {
    if (p.headers.length === 0 || p.rows.length === 0) {
      setError("That file has no rows we could read. Check it has a header row and at least one client.");
      return;
    }
    setError(null);
    setParsed(p);
    setMapping(autoMap(CLIENT_IMPORT_FIELDS, p));
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setError(null);
    parseFile(file)
      .then(load)
      .catch(() => setError("Couldn't read that file. A .csv or .xlsx export works best."))
      .finally(() => setParsing(false));
  };

  const usePaste = () => {
    if (!pasteText.trim()) return;
    load(parseCsv(pasteText, "pasted.csv"));
  };

  // Re-map: a column maps to at most one field; assigning steals it from any other.
  const setColumn = (colIndex: number, fieldKey: string | null) =>
    setMapping((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === colIndex) next[k] = null;
      if (fieldKey) next[fieldKey] = colIndex;
      return next;
    });

  const reset = () => { setParsed(null); setMapping({}); setError(null); setPasteMode(false); setPasteText(""); };
  const close = () => { setOpen(false); reset(); };

  const canImport = Boolean(parsed && mapping.name != null && result && result.ready.length > 0);

  const submit = () => {
    if (!result || !canImport) return;
    start(async () => {
      const res = await importClients({ clients: result.ready });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `${res.count} client${res.count === 1 ? "" : "s"} imported`, description: "Added to your caseload, unassigned. Consent is requested at first contact." });
      close();
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Upload className="size-4" strokeWidth={2} aria-hidden /> Import
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Import clients"
        description={parsed ? `${parsed.fileName} · ${parsed.rows.length} rows — check the column mapping, then import.` : "Upload a CSV or Excel export — we'll map the columns for you."}
        className="sm:max-w-4xl"
        footer={
          parsed ? (
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={reset} disabled={pending}>
                <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Choose another file
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
                <Button onClick={submit} loading={pending} disabled={!canImport}>
                  Import {result?.ready.length ? result.ready.length : ""} client{result?.ready.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {!parsed ? (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragOver ? "border-accent bg-accent-soft/40" : "border-border bg-surface-2/30 hover:border-border-strong hover:bg-surface-2/60",
              )}
            >
              <span className={cn("flex size-12 items-center justify-center rounded-full transition-colors", dragOver ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-3")}>
                {parsing ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <UploadCloud className="size-6" strokeWidth={1.9} aria-hidden />}
              </span>
              <div className="text-[14.5px] font-[620] text-text">{parsing ? "Reading your file…" : "Drop your file here, or click to browse"}</div>
              <div className="flex items-center gap-1.5 text-[12px] text-text-3"><FileSpreadsheet className="size-3.5" strokeWidth={2} aria-hidden /> CSV or Excel (.xlsx) · any column order</div>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} aria-hidden />
            </div>

            {error && <p role="alert" className="text-[12.5px] font-medium text-danger">{error}</p>}

            {/* Paste fallback */}
            {pasteMode ? (
              <div className="space-y-2">
                <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"Name, Phone, Email, Province\nLerato Mahlangu, 082 123 4567, lerato@example.co.za, Gauteng"} className="min-h-[120px] font-mono text-[12.5px]" aria-label="Paste rows" />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={usePaste} disabled={!pasteText.trim()}>Continue</Button>
                  <button type="button" onClick={() => setPasteMode(false)} className="text-[12px] text-text-3 hover:text-text">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="text-center text-[12.5px] text-text-3">
                or <button type="button" onClick={() => setPasteMode(true)} className="font-medium text-accent hover:underline">paste your rows</button> instead
              </div>
            )}
          </div>
        ) : result ? (
          <ColumnMapper fields={CLIENT_IMPORT_FIELDS} parsed={parsed} mapping={mapping} result={result} onSetColumn={setColumn} />
        ) : null}
      </Dialog>
    </>
  );
}
