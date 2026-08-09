"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Eye, GripVertical, ListChecks, Palette, Plus, Save, SplitSquareVertical, Trash2, X } from "lucide-react";
import type { Form, FormField, FormTheme } from "@/lib/domain/types";
import { FORM_KINDS, FORM_KIND_LABELS, type FormKind } from "@/lib/domain/enums";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { IntakeDetail } from "@/components/hub/intake-detail";
import { FormDesign } from "@/components/hub/form-design";
import { DEFAULT_THEME } from "@/components/forms/form-theme";
import { saveForm } from "@/app/hub/forms/actions";
import { cn } from "@/lib/utils";

type FieldType = FormField["type"];

const TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "tel", label: "Phone number" },
  { value: "email", label: "Email" },
  { value: "radio", label: "Single choice" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Tick all that apply" },
  { value: "scale", label: "Linear scale (1-5)" },
  { value: "acknowledge", label: "Acknowledgement tick" },
  { value: "statement", label: "Statement (no answer)" },
  { value: "section", label: "Section break (new step)" },
];

/** Types that carry a list of options. */
const HAS_OPTIONS: FieldType[] = ["radio", "select", "checkbox"];
/** Layout blocks - no required flag, no PII flag, no answer. */
const IS_BLOCK: FieldType[] = ["statement", "section"];

const KIND_OPTIONS = FORM_KINDS.map((k) => ({ value: k, label: FORM_KIND_LABELS[k] }));

/**
 * Starter templates for a brand-new form (create mode only). `steps` is derived,
 * not stored - a template with `section` blocks simply becomes a multi-step form.
 */
const TEMPLATES: Record<string, { label: string; kind: FormKind; title: string; intro: string; fields: FormField[] }> = {
  blank: { label: "Blank", kind: "custom", title: "", intro: "", fields: [{ id: "q1", label: "", type: "text", required: false }] },
  intake: {
    label: "Intake", kind: "intake", title: "A few details before we meet",
    intro: "This helps your counsellor prepare. Only your counsellor sees it, and it's kept confidential under POPIA.",
    fields: [
      { id: "full_name", label: "Your full name", type: "text", required: true, sensitive: true },
      { id: "phone", label: "Mobile number", type: "tel", required: true, sensitive: true, help: "We'll use this to confirm your session." },
      { id: "reason", label: "What would you like support with?", type: "textarea", required: true },
      { id: "preferred_contact", label: "How should we reach you?", type: "radio", required: true, options: ["WhatsApp", "Phone call", "Email"] },
    ],
  },
  feedback: {
    label: "Feedback", kind: "feedback", title: "After your session",
    intro: "A couple of quick questions so we can keep improving your care.",
    fields: [
      { id: "helpful", label: "How helpful was your session?", type: "radio", required: true, options: ["Very helpful", "Helpful", "Neutral", "Not helpful"] },
      { id: "comments", label: "Anything you'd like us to know?", type: "textarea", required: false },
    ],
  },
  screening: {
    label: "Screening", kind: "screening", title: "A quick check-in",
    intro: "Over the last two weeks, how often have you been bothered by the following? There are no right answers.",
    fields: [
      { id: "interest", label: "Little interest or pleasure in doing things", type: "radio", required: true, options: ["Not at all", "Several days", "More than half the days", "Nearly every day"] },
      { id: "down", label: "Feeling down, depressed, or hopeless", type: "radio", required: true, options: ["Not at all", "Several days", "More than half the days", "Nearly every day"] },
    ],
  },
  intake_full: {
    label: "Full intake (3 steps)", kind: "intake", title: "Intake Form | CONFIDENTIAL",
    intro: "Welcome, and thank you for taking this first step toward accessing support. This form gathers what your counsellor needs to prepare. Everything you share is kept confidential under POPIA.",
    fields: [
      { id: "s_about", label: "About you", type: "section", required: false, help: "A few details so we know who we are meeting." },
      { id: "first_name", label: "First name", type: "text", required: true, sensitive: true },
      { id: "surname", label: "Surname", type: "text", required: true, sensitive: true },
      { id: "phone", label: "Telephone number", type: "tel", required: true, sensitive: true, help: "We use this to confirm your session." },
      { id: "email", label: "Email", type: "email", required: false, sensitive: true },
      { id: "address", label: "Residential address", type: "text", required: false, sensitive: true },
      { id: "province", label: "Province", type: "select", required: true, options: ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"] },
      { id: "age", label: "Age", type: "number", required: true },
      { id: "gender", label: "Gender", type: "radio", required: false, options: ["Woman", "Man", "Transgender", "Non-binary", "Prefer not to say", "Other"] },
      { id: "pronouns", label: "Preferred pronouns", type: "text", required: false },
      { id: "marital", label: "Marital status", type: "select", required: false, options: ["Single", "Living together (with a partner)", "Married", "Widowed", "Divorced or separated", "Other"] },
      { id: "work", label: "Work status", type: "select", required: false, options: ["Unemployed or not working", "Employee or worker", "Self-employed", "Volunteer", "Student", "Other"] },
      { id: "trusted_name", label: "Trusted person - name & surname", type: "text", required: true, sensitive: true, help: "Someone we may contact in an emergency." },
      { id: "trusted_phone", label: "Trusted person - telephone number", type: "tel", required: true, sensitive: true },
      { id: "s_health", label: "Your health & history", type: "section", required: false, help: "None of this changes your care - it only helps your counsellor prepare." },
      { id: "diagnosis", label: "Have you been diagnosed with any psychiatric illness(es) by a medical doctor, psychologist or psychiatrist?", type: "textarea", required: false, help: "Write \"None\" if that is the case." },
      { id: "medication", label: "Do you take any prescribed medication?", type: "textarea", required: false, help: "Write \"None\" if that is the case." },
      { id: "disability", label: "Do you live with any disability or long-term condition that affects your daily functioning?", type: "textarea", required: false },
      { id: "prior", label: "Have you had counselling before?", type: "radio", required: true, options: ["No", "Yes"] },
      { id: "prior_detail", label: "If yes, how long ago and from where?", type: "text", required: false },
      { id: "heard", label: "How did you hear about us?", type: "select", required: false, options: ["Instagram", "Facebook", "TikTok", "Word of mouth", "Website", "Other"] },
      { id: "brings", label: "What brings you to counselling?", type: "checkbox", required: true, options: ["Feeling low, down, or depressed", "Anxiety, stress, or worry", "Trauma or difficult past experiences", "Grief or loss", "Anger or emotional regulation", "Identity, self-esteem, or sense of self", "Eating or body-related concerns", "Sleep or fatigue difficulties", "Relationship challenges", "Life changes or transitions (work, study, relocation)", "General support / not sure where to start", "Other"] },
      { id: "s_consent", label: "Consent & acknowledgements", type: "section", required: false, help: "Please read and confirm the following before proceeding:" },
      { id: "st1", label: "1. Short-term, supportive counselling", type: "statement", required: false, help: "We provide short-term, supportive counselling and are not a crisis or emergency service." },
      { id: "ack1", label: "Do you understand and accept this?", type: "acknowledge", required: true, placeholder: "I acknowledge" },
      { id: "st2", label: "2. Confidentiality and its limits", type: "statement", required: false, help: "Information shared during counselling is kept confidential, except where there is a risk of harm to you or others, or where disclosure is required by law." },
      { id: "ack2", label: "Do you understand and accept this?", type: "acknowledge", required: true, placeholder: "I acknowledge" },
      { id: "st3", label: "3. Safety", type: "statement", required: false, help: "If your counsellor believes you are at risk of harm, they may contact your trusted person or relevant services to keep you safe." },
      { id: "ack3", label: "Do you understand and accept this?", type: "acknowledge", required: true, placeholder: "I acknowledge" },
      { id: "followup", label: "May we contact you for follow-up related to your care, evaluation, or research? Any identifying information is protected and anonymised.", type: "radio", required: true, options: ["Yes", "No"] },
    ],
  },
  k10: {
    label: "K10 distress scale (2 steps)", kind: "screening", title: "(K10) Kessler Psychological Distress Scale",
    intro: "This questionnaire measures psychological distress - stress, anxiety, low mood - over the past 4 weeks. There are no right or wrong answers.",
    fields: [
      { id: "s_intro", label: "Before you begin", type: "section", required: false, help: "The questions ask how often you have felt certain ways in the past 4 weeks. This is a screening tool, not a diagnosis - it guides the conversation with your counsellor." },
      { id: "ready", label: "I understand this is not a diagnosis", type: "acknowledge", required: true, placeholder: "I understand" },
      { id: "s_k10", label: "The past 4 weeks", type: "section", required: false, help: "Please answer honestly based on your own experience." },
      { id: "k1", label: "1. In the past 4 weeks, about how often did you feel tired for no good reason?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k2", label: "2. In the past 4 weeks, about how often did you feel nervous?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k3", label: "3. In the past 4 weeks, about how often did you feel so nervous that nothing could calm you down?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k4", label: "4. In the past 4 weeks, about how often did you feel hopeless?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k5", label: "5. In the past 4 weeks, about how often did you feel restless and fidgety?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k6", label: "6. In the past 4 weeks, about how often did you feel so restless you could not sit still?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k7", label: "7. In the past 4 weeks, about how often did you feel depressed?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k8", label: "8. In the past 4 weeks, about how often did you feel that everything was an effort?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k9", label: "9. In the past 4 weeks, about how often did you feel so sad that nothing could cheer you up?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
      { id: "k10", label: "10. In the past 4 weeks, about how often did you feel worthless?", type: "scale", required: true, scale: { min: 1, max: 5, minLabel: "None of the time", maxLabel: "All the time" } },
    ],
  },
};

export function FormBuilder({ initial, orgId, orgName }: { initial: Form | null; orgId: string; orgName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const isNew = !initial;

  const [tab, setTab] = useState<"build" | "design">("build");
  const [kind, setKind] = useState<FormKind>(initial?.kind ?? "custom");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [fields, setFields] = useState<FormField[]>(initial?.fields ?? [{ id: "q1", label: "", type: "text", required: false }]);
  const [theme, setTheme] = useState<FormTheme>(initial?.theme ?? { layout: "form", hero: {}, background: DEFAULT_THEME.background });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const counter = useRef((initial?.fields.length ?? 1) + 1);

  const applyTemplate = (key: string) => {
    const t = TEMPLATES[key];
    if (!t) return;
    setKind(t.kind);
    setTitle(t.title);
    setIntro(t.intro);
    setFields(t.fields.map((f) => ({ ...f })));
    counter.current = t.fields.length + 1;
  };

  const patch = (i: number, next: Partial<FormField>) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...next } : f)));
  const move = (i: number, dir: -1 | 1) =>
    setFields((fs) => {
      const j = i + dir;
      const a = fs[i], b = fs[j];
      if (!a || !b) return fs;
      const copy = [...fs];
      copy[i] = b; copy[j] = a;
      return copy;
    });
  const add = () => setFields((fs) => [...fs, { id: `q${counter.current++}`, label: "", type: "text", required: false }]);
  /** Batch 2l - a section break is how a form becomes multi-step; make it a button. */
  const addSection = () => setFields((fs) => [...fs, { id: `s${counter.current++}`, label: "", type: "section", required: false }]);
  const remove = (i: number) => setFields((fs) => fs.filter((_, idx) => idx !== i));

  // How many steps the client will see (a section block opens each one).
  const stepCount = Math.max(1, fields.filter((f) => f.type === "section").length);

  const draftForm: Form = {
    id: initial?.id ?? `draft_${orgId}`, orgId, kind, title, intro: intro || undefined, fields,
    status: initial?.status ?? "active", createdAt: initial?.createdAt ?? "", updatedAt: initial?.updatedAt ?? "",
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await saveForm({
      id: initial?.id,
      kind,
      title,
      intro,
      fields: fields.map((f) => ({
        id: f.id, label: f.label, type: f.type, required: f.required, help: f.help ?? "",
        placeholder: f.placeholder ?? "", sensitive: f.sensitive,
        options: HAS_OPTIONS.includes(f.type) ? f.options ?? [] : undefined,
        scale: f.type === "scale" ? { min: 1, max: f.scale?.max ?? 5, minLabel: f.scale?.minLabel ?? "", maxLabel: f.scale?.maxLabel ?? "" } : undefined,
        maxChoices: f.type === "checkbox" && f.maxChoices ? f.maxChoices : undefined,
      })),
      theme,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    if (isNew) {
      toast({ tone: "success", title: "Form created", description: "Send it to a client whenever you're ready." });
      router.push(`/hub/forms/${res.id}`);
    } else {
      toast({ tone: "success", title: "Form saved" });
      router.push(`/hub/forms/${res.id}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border">
        <BuilderTab active={tab === "build"} onClick={() => setTab("build")} icon={ListChecks}>Build</BuilderTab>
        <BuilderTab active={tab === "design"} onClick={() => setTab("design")} icon={Palette}>Design</BuilderTab>
      </div>

      {tab === "design" ? (
        <FormDesign theme={theme} orgName={orgName} onChange={setTheme} />
      ) : (
      <div className="space-y-5">
      {isNew && (
        <Card className="space-y-2 p-4">
          <div className="text-[12.5px] font-medium text-text">Start from a template</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TEMPLATES).map(([key, t]) => {
              const steps = t.fields.filter((f) => f.type === "section").length;
              return (
                <button key={key} type="button" onClick={() => applyTemplate(key)} className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-2 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent">
                  {t.label}
                  <span className="text-[11px] text-text-3">{t.fields.filter((f) => f.type !== "section" && f.type !== "statement").length} q{steps > 1 ? ` · ${steps} steps` : ""}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-text-3">A template with steps drops in <strong className="font-medium text-text-2">Section breaks</strong> - the client then fills it one step at a time.</p>
        </Card>
      )}

      {/* Form header */}
      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="form-title" required>Form title</Label>
            <Input id="form-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A few details before we meet" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-kind">Type</Label>
            <div className="w-44"><Select value={kind} options={KIND_OPTIONS} onChange={(v) => setKind(v as FormKind)} /></div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-intro" optional>Intro shown to the client</Label>
          <Textarea id="form-intro" value={intro} onChange={(e) => setIntro(e.target.value)} className="min-h-[64px]" placeholder="A reassuring sentence about why you ask and that it's confidential." />
        </div>
        {kind === "intake" && (
          <p className="text-[11.5px] text-text-3">The active <strong>Intake</strong> form is the one shown during public booking.</p>
        )}
      </Card>

      {/* Questions */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-text">
            Questions <span className="text-text-3">({fields.filter((f) => f.type !== "section" && f.type !== "statement").length})</span>
          </h2>
          {stepCount > 1 && (
            <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent">
              {stepCount} steps for the client
            </span>
          )}
        </div>

        {fields.map((f, i) => (
          <Card key={f.id} className={cn("p-4", f.type === "section" && "border-l-[3px] border-l-accent bg-accent-soft/20")}>
            {f.type === "section" && (
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                Step {fields.slice(0, i + 1).filter((x) => x.type === "section").length} starts here
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-text-3 hover:text-text disabled:opacity-30" aria-label="Move up"><ChevronUp className="size-4" /></button>
                <GripVertical className="size-3.5 text-text-3/60" aria-hidden />
                <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="text-text-3 hover:text-text disabled:opacity-30" aria-label="Move down"><ChevronDown className="size-4" /></button>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  value={f.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                  placeholder={f.type === "section" ? `Section ${i + 1} - e.g. Consent & acknowledgements` : f.type === "statement" ? "Statement heading - e.g. Please read before continuing" : `Question ${i + 1} - e.g. What would you like support with?`}
                  className="font-medium"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-52"><Select value={f.type} options={TYPES} onChange={(v) => patch(i, { type: v as FieldType })} /></div>
                  {!IS_BLOCK.includes(f.type) && <Chip on={f.required} onClick={() => patch(i, { required: !f.required })}>Required</Chip>}
                  {!IS_BLOCK.includes(f.type) && <Chip on={Boolean(f.sensitive)} onClick={() => patch(i, { sensitive: !f.sensitive })}>Confidential (PII)</Chip>}
                  {f.type === "section" && <span className="text-[11.5px] text-text-3">Everything below starts a new step for the client.</span>}
                </div>
                {HAS_OPTIONS.includes(f.type) && <OptionsEditor options={f.options ?? []} onChange={(options) => patch(i, { options })} />}
                {f.type === "scale" && (
                  <div className="flex flex-wrap items-end gap-2.5 rounded-control border border-border bg-surface-2/40 p-3">
                    <div className="space-y-1">
                      <Label className="text-[11.5px]">Points</Label>
                      <div className="w-24">
                        <Select
                          value={String(f.scale?.max ?? 5)}
                          options={[3, 4, 5, 7, 10].map((n) => ({ value: String(n), label: `1 - ${n}` }))}
                          onChange={(v) => patch(i, { scale: { min: 1, max: Number(v), minLabel: f.scale?.minLabel ?? "", maxLabel: f.scale?.maxLabel ?? "" } })}
                        />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-[11.5px]">Label at 1</Label>
                      <Input value={f.scale?.minLabel ?? ""} onChange={(e) => patch(i, { scale: { min: 1, max: f.scale?.max ?? 5, minLabel: e.target.value, maxLabel: f.scale?.maxLabel ?? "" } })} placeholder="None of the time" className="h-9 text-[13px]" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-[11.5px]">Label at {f.scale?.max ?? 5}</Label>
                      <Input value={f.scale?.maxLabel ?? ""} onChange={(e) => patch(i, { scale: { min: 1, max: f.scale?.max ?? 5, minLabel: f.scale?.minLabel ?? "", maxLabel: e.target.value } })} placeholder="All the time" className="h-9 text-[13px]" />
                    </div>
                  </div>
                )}
                {f.type === "acknowledge" && (
                  <Input value={f.placeholder ?? ""} onChange={(e) => patch(i, { placeholder: e.target.value })} placeholder="Tick label - e.g. I acknowledge" className="h-9 text-[13px]" />
                )}
                <Input
                  value={f.help ?? ""}
                  onChange={(e) => patch(i, { help: e.target.value })}
                  placeholder={IS_BLOCK.includes(f.type) ? "The wording shown to the client (optional)" : "Helper text under the question (optional)"}
                  className="h-9 text-[13px]"
                />
              </div>

              <button type="button" onClick={() => remove(i)} disabled={fields.length === 1} className="mt-1 text-text-3 hover:text-danger disabled:opacity-30" aria-label="Delete question"><Trash2 className="size-4" /></button>
            </div>
          </Card>
        ))}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={add} className="flex-1 border border-dashed border-border">
            <Plus className="size-4" strokeWidth={2} aria-hidden /> Add question
          </Button>
          <Button variant="ghost" onClick={addSection} className="flex-1 border border-dashed border-accent/40 text-accent">
            <SplitSquareVertical className="size-4" strokeWidth={2} aria-hidden /> Add step (section break)
          </Button>
        </div>
        <p className="text-[11.5px] text-text-3">
          Everything after a step break becomes its own page for the client, with Back / Continue and a progress bar.
        </p>
      </div>
      </div>
      )}

      <FieldError>{error}</FieldError>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-2 rounded-card border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
        <Button variant="ghost" onClick={() => setPreview(true)}>
          <Eye className="size-4" strokeWidth={2} aria-hidden /> Preview
        </Button>
        <Button onClick={save} loading={saving}>
          <Save className="size-4" strokeWidth={2} aria-hidden /> {isNew ? "Create form" : "Save form"}
        </Button>
      </div>

      <IntakeDetail open={preview} onClose={() => setPreview(false)} form={draftForm} />
    </div>
  );
}

function BuilderTab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof ListChecks; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors", active ? "border-accent text-accent" : "border-transparent text-text-3 hover:text-text")}>
      <Icon className="size-4" strokeWidth={2} aria-hidden /> {children}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("inline-flex h-9 items-center rounded-control border px-3 text-[12.5px] font-medium transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}>
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
