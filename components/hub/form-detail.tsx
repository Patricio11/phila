"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Inbox, ListChecks, Pencil, Send } from "lucide-react";
import type { Form, IntakeForm } from "@/lib/domain/types";
import type { FormResponseRow } from "@/lib/data-provider";
import { FORM_KIND_LABELS } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Tag, type TagTone } from "@/components/ui/tag";
import { FormFields } from "@/components/forms/form-fields";
import { IntakeDetail } from "@/components/hub/intake-detail";
import { SendFormModal, type SendClient } from "@/components/hub/send-form-modal";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<string, TagTone> = { intake: "accent", feedback: "info", screening: "warn", consent: "neutral", custom: "neutral" };
const TYPE_LABEL: Record<string, string> = { text: "Short text", textarea: "Paragraph", tel: "Phone number", email: "Email", radio: "Multiple choice" };
const STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-accent-soft text-accent" },
  sent: { label: "Sent · awaiting", cls: "bg-warn-soft text-warn" },
  revoked: { label: "Revoked", cls: "bg-surface-2 text-text-3" },
};

type Tab = "responses" | "questions" | "preview";

export function FormDetail({ form, responses, clients }: { form: Form; responses: FormResponseRow[]; clients: SendClient[] }) {
  const [tab, setTab] = useState<Tab>("responses");
  const [sendOpen, setSendOpen] = useState(false);
  const [viewing, setViewing] = useState<FormResponseRow | null>(null);

  const completed = responses.filter((r) => r.status === "completed").length;
  const awaiting = responses.filter((r) => r.status === "sent").length;

  const asIntakeForm = (r: FormResponseRow): IntakeForm => ({
    id: r.assignmentId, orgId: form.orgId, title: r.snapshot.title, intro: r.snapshot.intro, fields: r.snapshot.fields,
  });

  return (
    <div className="rise space-y-5">
      <div>
        <Link href="/hub/forms" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-text-3 hover:text-text">
          <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> All forms
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-[680] tracking-[-0.02em] text-text">{form.title}</h1>
              <Tag tone={KIND_TONE[form.kind] ?? "neutral"}>{FORM_KIND_LABELS[form.kind]}</Tag>
              {form.status === "archived" && <Tag tone="neutral">Archived</Tag>}
            </div>
            {form.intro && <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-2">{form.intro}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link href={`/hub/forms/${form.id}/edit`}><Pencil className="size-4" strokeWidth={2} aria-hidden /> Edit</Link></Button>
            <Button onClick={() => setSendOpen(true)}><Send className="size-4" strokeWidth={2} aria-hidden /> Send form</Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "responses"} onClick={() => setTab("responses")} icon={Inbox}>Responses{responses.length ? ` (${responses.length})` : ""}</TabButton>
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")} icon={ListChecks}>Questions</TabButton>
        <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye}>Preview</TabButton>
      </div>

      {tab === "responses" ? (
        responses.length === 0 ? (
          <EmptyResponses onSend={() => setSendOpen(true)} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3.5 sm:max-w-md">
              <Stat value={String(completed)} label="Completed" tone="accent" />
              <Stat value={String(awaiting)} label="Awaiting" tone="warn" />
              <Stat value={String(responses.length)} label="Sent" tone="muted" />
            </div>
            <div className="overflow-hidden rounded-card border border-border">
              {responses.map((r, i) => (
                <div key={r.assignmentId} className={cn("flex items-center gap-3 px-3.5 py-2.5", i > 0 && "border-t border-border")}>
                  <Avatar name={r.clientName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-text">{r.clientName}</div>
                    <div className="truncate text-[11.5px] text-text-3">{r.counsellorName}</div>
                  </div>
                  <span className={cn("hidden shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold sm:inline-flex", STATUS[r.status]?.cls)}>{STATUS[r.status]?.label}</span>
                  {r.status === "completed" ? (
                    <Button variant="mini" onClick={() => setViewing(r)}><Eye className="size-3.5" strokeWidth={2} aria-hidden /> View answers</Button>
                  ) : (
                    <span className="text-[11.5px] text-text-3">no reply yet</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ) : tab === "questions" ? (
        <ol className="space-y-2.5">
          {form.fields.map((f, i) => (
            <li key={f.id} className="flex items-start gap-3 rounded-card border border-border bg-surface p-3.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-text-3 tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-text">
                  {f.label || <span className="italic text-text-3">Untitled question</span>}
                  {f.required && <span className="text-danger">*</span>}
                  {f.sensitive && <Tag tone="neutral">Confidential</Tag>}
                </div>
                <div className="mt-0.5 text-[12px] text-text-3">
                  {TYPE_LABEL[f.type] ?? f.type}
                  {f.type === "radio" && f.options?.length ? ` · ${f.options.join(" · ")}` : ""}
                  {f.help ? ` · ${f.help}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mx-auto max-w-xl rounded-card border border-border bg-surface p-5 sm:p-6">
          <div className="mb-4 border-b border-border pb-3">
            <h2 className="text-[16px] font-[640] text-text">{form.title}</h2>
            {form.intro && <p className="mt-1 text-[13px] leading-relaxed text-text-2">{form.intro}</p>}
          </div>
          <FormFields fields={form.fields} readOnly idPrefix="detail-preview" />
          <p className="mt-5 text-center text-[11.5px] text-text-3">This is exactly what a client sees.</p>
        </div>
      )}

      <SendFormModal open={sendOpen} onClose={() => setSendOpen(false)} formId={form.id} formTitle={form.title} clients={clients} />
      <IntakeDetail
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        form={viewing ? asIntakeForm(viewing) : null}
        clientName={viewing?.clientName}
        status={viewing?.status === "completed" ? "completed" : "sent"}
        submittedAt={viewing?.submittedAt}
        answers={viewing?.answers}
      />
    </div>
  );
}

function EmptyResponses({ onSend }: { onSend: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-2/30 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"><Inbox className="size-5" strokeWidth={1.9} aria-hidden /></span>
      <h3 className="mt-3 text-[15px] font-[640] text-text">No responses yet</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-2">Send this form to a client and their answers will land here the moment they submit.</p>
      <Button className="mt-5" onClick={onSend}><Send className="size-4" strokeWidth={2} aria-hidden /> Send form</Button>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: "accent" | "warn" | "muted" }) {
  const cls = tone === "accent" ? "text-accent" : tone === "warn" ? "text-warn" : "text-text-3";
  return (
    <div className="rounded-card border border-border bg-surface p-3.5 shadow-sm">
      <div className={cn("text-[20px] font-bold tabular-nums", cls)}>{value}</div>
      <div className="text-[12px] text-text-2">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof ListChecks; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors", active ? "border-accent text-accent" : "border-transparent text-text-3 hover:text-text")}>
      <Icon className="size-4" strokeWidth={2} aria-hidden /> {children}
    </button>
  );
}
