"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ListChecks, Pencil, Eye } from "lucide-react";
import type { Form } from "@/lib/domain/types";
import { FORM_KIND_LABELS } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Tag, type TagTone } from "@/components/ui/tag";
import { FormFields } from "@/components/forms/form-fields";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<string, TagTone> = { intake: "accent", feedback: "info", screening: "warn", consent: "neutral", custom: "neutral" };
const TYPE_LABEL: Record<string, string> = { text: "Short text", textarea: "Paragraph", tel: "Phone number", email: "Email", radio: "Multiple choice" };

type Tab = "questions" | "preview";

export function FormDetail({ form }: { form: Form }) {
  const [tab, setTab] = useState<Tab>("questions");

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
          <Button asChild variant="ghost">
            <Link href={`/hub/forms/${form.id}/edit`}><Pencil className="size-4" strokeWidth={2} aria-hidden /> Edit</Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")} icon={ListChecks}>Questions</TabButton>
        <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye}>Preview</TabButton>
      </div>

      {tab === "questions" ? (
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
          <p className={cn("mt-5 text-center text-[11.5px] text-text-3")}>This is exactly what a client sees.</p>
        </div>
      )}
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
