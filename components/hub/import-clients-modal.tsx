"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FileUp, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { importClients } from "@/app/hub/clients/actions";

interface ParsedRow { name: string; phone?: string; email?: string; province?: string }

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  lines.forEach((line, i) => {
    const cols = line.split(/[,\t]/).map((c) => c.trim());
    if (i === 0 && /name/i.test(cols[0] ?? "") && /(phone|email|province)/i.test(line)) return; // header
    const [name, phone, email, province] = cols;
    if (!name || name.length < 2) return;
    rows.push({ name, phone: phone || undefined, email: email || undefined, province: province || undefined });
  });
  return rows;
}

export function ImportClientsButton({ counsellors }: { counsellors: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [counsellorId, setCounsellorId] = useState<string | null>(counsellors[0]?.id ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => parseCsv(text), [text]);

  const onFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  const submit = () => {
    if (rows.length === 0 || !counsellorId) return;
    start(async () => {
      const res = await importClients({ counsellorId, clients: rows });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `${res.count} client${res.count === 1 ? "" : "s"} imported`, description: `Added to ${counsellors.find((c) => c.id === counsellorId)?.name.split(" ")[0]}'s caseload. Consent is requested at first contact.` });
      setOpen(false);
      setText("");
    });
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Upload className="size-4" strokeWidth={2} aria-hidden /> Import
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Import clients"
        description="Paste a list or upload a CSV. One client per line: name, phone, email, province."
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-text-3">{rows.length} ready to import</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={submit} loading={pending} disabled={rows.length === 0}>Import {rows.length || ""}</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assign all to</Label>
            <Select value={counsellorId} onChange={setCounsellorId} options={counsellors.map((c) => ({ value: c.id, label: c.name }))} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Paste rows</Label>
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                <FileUp className="size-3.5" strokeWidth={2} aria-hidden /> Upload CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onFile} aria-hidden />
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Lerato Mahlangu, 082 123 4567, lerato@example.co.za, Gauteng\nSipho Khumalo, 071 555 0192, , KwaZulu-Natal"}
              className="min-h-[160px] font-mono text-[12.5px]"
              aria-label="Client rows"
            />
            <p className="text-[11px] text-text-3">A header row is detected and skipped. Phone, email and province are optional.</p>
          </div>

          {rows.length > 0 && (
            <div className="rounded-control border border-border bg-surface-2/40 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Preview</div>
              <ul className="space-y-1 text-[12.5px]">
                {rows.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="font-medium text-text">{r.name}</span>
                    <span className="truncate text-text-3">{[r.phone, r.email, r.province].filter(Boolean).join(" · ") || "no extra details"}</span>
                  </li>
                ))}
                {rows.length > 5 && <li className="text-text-3">+{rows.length - 5} more</li>}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
