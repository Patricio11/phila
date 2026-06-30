"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import type { IntakeField, IntakeForm } from "@/lib/domain/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { IntakeDetail } from "@/components/hub/intake-detail";
import { saveIntakeForm } from "@/app/hub/intake/actions";
import { cn } from "@/lib/utils";

type FieldType = IntakeField["type"];

const TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Paragraph" },
  { value: "tel", label: "Phone number" },
  { value: "email", label: "Email" },
  { value: "radio", label: "Multiple choice" },
];

const BLANK_ORG_FORM = (orgId: string): IntakeForm => ({
  id: `intake_${orgId}`,
  orgId,
  title: "A few details before we meet",
  intro: "This helps your counsellor prepare. Only your counsellor sees it, and it's kept confidential under POPIA.",
  fields: [{ id: "q1", label: "Your full name", type: "text", required: true, sensitive: true }],
});

export function IntakeFormEditor({ initial, orgId }: { initial: IntakeForm | null; orgId: string }) {
  const { toast } = useToast();
  const base = initial ?? BLANK_ORG_FORM(orgId);
  const counter = useRef(base.fields.length + 1);

  const [title, setTitle] = useState(base.title);
  const [intro, setIntro] = useState(base.intro ?? "");
  const [fields, setFields] = useState<IntakeField[]>(base.fields);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const patch = (i: number, next: Partial<IntakeField>) =>
    setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...next } : f)));

  const move = (i: number, dir: -1 | 1) =>
    setFields((fs) => {
      const j = i + dir;
      const a = fs[i];
      const b = fs[j];
      if (!a || !b) return fs;
      const copy = [...fs];
      copy[i] = b;
      copy[j] = a;
      return copy;
    });

  const add = () => {
    const id = `q${counter.current++}`;
    setFields((fs) => [...fs, { id, label: "", type: "text", required: false }]);
  };

  const remove = (i: number) => setFields((fs) => fs.filter((_, idx) => idx !== i));

  const draft: IntakeForm = { ...base, title, intro: intro || undefined, fields };

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await saveIntakeForm({
      title,
      intro,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        help: f.help ?? "",
        sensitive: f.sensitive,
        options: f.type === "radio" ? f.options ?? [] : undefined,
      })),
    });
    setSaving(false);
    if (res.ok) toast({ tone: "success", title: "Intake form saved", description: "New clients will answer these questions before their first session." });
    else setError(res.error);
  };

  return (
    <div className="space-y-5">
      {/* Form header */}
      <Card className="space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="intake-title" required>Form title</Label>
          <Input id="intake-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A few details before we meet" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intake-intro" optional>Intro shown to the client</Label>
          <Textarea id="intake-intro" value={intro} onChange={(e) => setIntro(e.target.value)} className="min-h-[64px]" placeholder="A reassuring sentence about why you ask and that it's confidential." />
        </div>
      </Card>

      {/* Questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-text">Questions <span className="text-text-3">({fields.length})</span></h2>
        </div>

        {fields.map((f, i) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-text-3 hover:text-text disabled:opacity-30" aria-label="Move up"><ChevronUp className="size-4" /></button>
                <GripVertical className="size-3.5 text-text-3/60" aria-hidden />
                <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="text-text-3 hover:text-text disabled:opacity-30" aria-label="Move down"><ChevronDown className="size-4" /></button>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <Input value={f.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder={`Question ${i + 1}  e.g. What would you like support with?`} className="font-medium" />

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-44">
                    <Select value={f.type} options={TYPES} onChange={(v) => patch(i, { type: v as FieldType })} />
                  </div>
                  <Chip on={f.required} onClick={() => patch(i, { required: !f.required })}>Required</Chip>
                  <Chip on={Boolean(f.sensitive)} onClick={() => patch(i, { sensitive: !f.sensitive })}>Confidential (PII)</Chip>
                </div>

                {f.type === "radio" && <OptionsEditor options={f.options ?? []} onChange={(options) => patch(i, { options })} />}

                <Input value={f.help ?? ""} onChange={(e) => patch(i, { help: e.target.value })} placeholder="Helper text under the question (optional)" className="h-9 text-[13px]" />
              </div>

              <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="mt-1 text-text-3 hover:text-danger disabled:opacity-30" aria-label="Delete question"><Trash2 className="size-4" /></button>
            </div>
          </Card>
        ))}

        <Button variant="ghost" onClick={add} className="w-full border border-dashed border-border">
          <Plus className="size-4" strokeWidth={2} aria-hidden /> Add question
        </Button>
      </div>

      <FieldError>{error}</FieldError>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-2 rounded-card border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
        <Button variant="ghost" onClick={() => setPreview(true)}>
          <Eye className="size-4" strokeWidth={2} aria-hidden /> Preview
        </Button>
        <Button onClick={save} loading={saving}>
          <Save className="size-4" strokeWidth={2} aria-hidden /> Save form
        </Button>
      </div>

      <IntakeDetail open={preview} onClose={() => setPreview(false)} form={draft} />
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-9 items-center rounded-control border px-3 text-[12.5px] font-medium transition-colors",
        on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover",
      )}
    >
      {children}
    </button>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const list = options.length ? options : [""];
  return (
    <div className="space-y-1.5 rounded-control border border-border bg-surface-2/30 p-2.5">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-text-3">Choices</div>
      {list.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input value={opt} onChange={(e) => onChange(list.map((o, idx) => (idx === i ? e.target.value : o)))} placeholder={`Choice ${i + 1}`} className="h-9 text-[13px]" />
          <button type="button" onClick={() => onChange(list.filter((_, idx) => idx !== i))} disabled={list.length === 1} className="text-text-3 hover:text-danger disabled:opacity-30" aria-label="Remove choice"><X className="size-4" /></button>
        </div>
      ))}
      <Button variant="mini" onClick={() => onChange([...list, ""])}><Plus className="size-3.5" strokeWidth={2} aria-hidden /> Add choice</Button>
    </div>
  );
}
