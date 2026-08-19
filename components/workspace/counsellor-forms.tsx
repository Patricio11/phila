"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, Clock, Send } from "lucide-react";
import type { FormField } from "@/lib/domain/types";
import { Card, CardHead } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ResponseView, scaleTotal } from "@/components/forms/response-view";
import { downloadResponsePdf, type DocBrand } from "@/lib/export/response-pdf";
import { sendFormToMyClients } from "@/app/app/forms/actions";
import { cn } from "@/lib/utils";

interface SharedForm { id: string; title: string; intro: string | null; kind: string; fieldCount: number }
interface Response {
  id: string; formId: string; title: string; status: string;
  sentAt: string; submittedAt: string | null;
  snapshot: { title: string; fields: unknown[] };
  answers: Record<string, string> | null;
  clientId: string; clientName: string;
  /** Batch 4p - set when a counsellor (not the client) filled / must fill it. */
  filledBy?: string | null;
}
/** Batch 4p - a form waiting for THIS counsellor to fill, about one of their clients. */
export interface ToFill { assignmentId: string; token: string; formTitle: string; clientId: string; clientName: string; sentAt: string }

const DAY = (iso: string) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/**
 * Batch 2l - the counsellor's forms. Left: what the practice shared with them,
 * each with Send to my clients. Right: what their own clients have sent back,
 * openable in full. They never see another counsellor's clients.
 */
export function CounsellorForms({ forms, clients, responses, toFill = [], brand = null }: {
  forms: SharedForm[];
  clients: { id: string; name: string }[];
  responses: Response[];
  toFill?: ToFill[];
  /** Batch 4q - logo / accent / footer for the document view + export. */
  brand?: DocBrand | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sendFor, setSendFor] = useState<SharedForm | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Response | null>(null);

  const shown = clients.filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const completed = responses.filter((r) => r.status === "completed");
  const waiting = responses.filter((r) => r.status !== "completed");

  const send = () => start(async () => {
    if (!sendFor || picked.size === 0) return;
    const res = await sendFormToMyClients({ formId: sendFor.id, clientIds: [...picked] });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: `Sent to ${res.sent} client${res.sent === 1 ? "" : "s"}`, description: `${sendFor.title} - they get a private link.` });
    setSendFor(null); setPicked(new Set()); setQuery("");
    router.refresh();
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Batch 4p - forms the practice asked me to fill in */}
      {toFill.length > 0 && (
        <Card className="flex flex-col border-accent/30 lg:col-span-2" data-testid="to-fill">
          <CardHead title="For you to fill in" count={toFill.length} />
          <div className="grid gap-2 px-[17px] pb-[17px] sm:grid-cols-2">
            {toFill.map((t) => (
              <div key={t.assignmentId} className="flex items-center gap-3 rounded-control border border-accent/30 bg-accent-soft/20 p-3">
                <ClipboardList className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-[600] text-text">{t.formTitle}</div>
                  <div className="truncate text-[11.5px] text-text-3">about {t.clientName} · {DAY(t.sentAt)}</div>
                </div>
                <Button size="sm" asChild><a href={`/f/${t.token}`}>Fill in</a></Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {/* Shared with me */}
      <Card className="flex flex-col">
        <CardHead title="Shared with you" count={forms.length} />
        <div className="space-y-2 px-[17px] pb-[17px]">
          {forms.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nothing shared yet" body="Forms your practice shares with you appear here, ready to send to your clients." />
          ) : forms.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-[600] text-text">{f.title}</div>
                <div className="text-[11.5px] text-text-3">{f.kind} · {f.fieldCount} question{f.fieldCount === 1 ? "" : "s"}</div>
              </div>
              <Button size="sm" onClick={() => { setSendFor(f); setPicked(new Set()); }} disabled={clients.length === 0}>
                <Send className="size-3.5" strokeWidth={2} aria-hidden /> Send
              </Button>
            </div>
          ))}
          {forms.length > 0 && clients.length === 0 && (
            <p className="text-[12px] text-text-3">You have no clients on your caseload yet.</p>
          )}
        </div>
      </Card>

      {/* Responses from my clients */}
      <Card className="flex flex-col">
        <CardHead title="Responses" count={completed.length} />
        <div className="space-y-2 px-[17px] pb-[17px]">
          {responses.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No responses yet" body="When a client completes a form, their answers appear here and on their record." />
          ) : (
            <>
              {completed.map((r) => {
                const fields = (r.snapshot.fields ?? []) as FormField[];
                const total = r.answers ? scaleTotal(fields, r.answers) : null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setOpen(r)}
                    className="flex w-full items-center gap-3 rounded-control border border-border p-3 text-left transition-colors hover:bg-surface-hover"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-[600] text-text">{r.clientName}</div>
                      <div className="truncate text-[11.5px] text-text-3">{r.title} · {DAY(r.submittedAt ?? r.sentAt)}{r.filledBy ? ` · filled by ${r.filledBy}` : ""}</div>
                    </div>
                    {total && <span className="shrink-0 rounded-chip bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-text-2">Score {total.total}</span>}
                  </button>
                );
              })}
              {waiting.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-control border border-dashed border-border p-3">
                  <Clock className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-text-2">{r.clientName}</div>
                    <div className="truncate text-[11.5px] text-text-3">{r.title} · sent {DAY(r.sentAt)} · waiting</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* Send to my clients */}
      <Dialog
        open={Boolean(sendFor)}
        onClose={() => setSendFor(null)}
        title={sendFor ? `Send ${sendFor.title}` : "Send form"}
        description="Each client gets their own private link. Only your clients are listed."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendFor(null)} disabled={pending}>Cancel</Button>
            <Button onClick={send} loading={pending} disabled={picked.size === 0}>Send to {picked.size || ""} client{picked.size === 1 ? "" : "s"}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your clients…" />
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {shown.map((c) => {
              const on = picked.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setPicked((p) => { const n = new Set(p); if (on) n.delete(c.id); else n.add(c.id); return n; })}
                    className={cn("flex w-full items-center justify-between rounded-control px-3 py-2.5 text-left text-[13.5px] transition-colors", on ? "bg-accent-soft text-text" : "text-text-2 hover:bg-surface-hover")}
                  >
                    {c.name}
                    <span className={cn("inline-flex size-4 items-center justify-center rounded-[5px] border", on ? "border-accent bg-accent text-white" : "border-border")}>
                      {on && <CheckCircle2 className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Dialog>

      {/* Read a completed response */}
      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? open.title : "Response"}
        description={open ? `${open.clientName} · completed ${DAY(open.submittedAt ?? open.sentAt)}` : undefined}
        className="sm:max-w-3xl"
        footer={<div className="flex justify-end gap-2">
          {open?.answers && <Button variant="ghost" onClick={() => downloadResponsePdf({ formTitle: open.title, respondent: open.filledBy ? `${open.filledBy} (counsellor)` : open.clientName, submittedAt: open.submittedAt, fields: (open.snapshot.fields ?? []) as FormField[], answers: open.answers ?? {}, brand })}>Download PDF</Button>}
          <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button>
        </div>}
      >
        {open?.answers && <ResponseView fields={(open.snapshot.fields ?? []) as FormField[]} answers={open.answers} formTitle={open.title} brand={brand} respondent={open.filledBy ? `${open.filledBy} (counsellor)` : open.clientName} submittedAt={open.submittedAt} />}
      </Dialog>
    </div>
  );
}
