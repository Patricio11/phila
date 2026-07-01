"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ClipboardList, Copy, Pencil, Plus, Send } from "lucide-react";
import type { FormSummary } from "@/lib/data-provider";
import { FORM_KIND_LABELS } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Tag, type TagTone } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { duplicateForm, setFormArchived } from "@/app/hub/forms/actions";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<string, TagTone> = { intake: "accent", feedback: "info", screening: "warn", consent: "neutral", custom: "neutral" };

export function FormLibrary({ forms }: { forms: FormSummary[] }) {
  const active = forms.filter((f) => f.status === "active");
  const archived = forms.filter((f) => f.status === "archived");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-text-2">
          <ClipboardList className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
          <p className="max-w-xl">
            Your practice&apos;s forms  <span className="font-medium text-text">intake</span> (the questions before a first session) plus
            feedback, screening, or anything you need. Build once, send to one client or many, and read the replies here.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/hub/forms/new"><Plus className="size-4" strokeWidth={2} aria-hidden /> New form</Link>
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((f) => <FormCard key={f.id} form={f} />)}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-text-3">Archived</h2>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((f) => <FormCard key={f.id} form={f} archived />)}
          </div>
        </div>
      )}
    </div>
  );
}

function FormCard({ form, archived }: { form: FormSummary; archived?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const duplicate = () =>
    start(async () => {
      const res = await duplicateForm(form.id);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Form duplicated", description: "Edit the copy and send it whenever you're ready." });
      router.push(`/hub/forms/${res.id}/edit`);
    });

  const toggleArchive = () =>
    start(async () => {
      const res = await setFormArchived(form.id, !archived);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: archived ? "Form restored" : "Form archived" });
      router.refresh();
    });

  return (
    <div className={cn("group flex flex-col rounded-card border bg-surface p-4 shadow-sm transition-colors", archived ? "border-border opacity-80" : "border-border hover:border-accent/40")}>
      <div className="flex items-start justify-between gap-2">
        <Tag tone={KIND_TONE[form.kind] ?? "neutral"}>{FORM_KIND_LABELS[form.kind]}</Tag>
        <span className="text-[11px] text-text-3">{form.fieldCount} question{form.fieldCount === 1 ? "" : "s"}</span>
      </div>

      <Link href={`/hub/forms/${form.id}`} className="mt-2.5 block">
        <h3 className="text-[15px] font-[640] leading-snug text-text group-hover:text-accent">{form.title}</h3>
        {form.intro && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-text-3">{form.intro}</p>}
      </Link>

      <div className="mt-3 flex items-center gap-4 text-[12px] text-text-2">
        <span className="inline-flex items-center gap-1.5"><Send className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {form.sentCount} sent</span>
        <span className={cn("font-medium", form.completedCount > 0 ? "text-accent" : "text-text-3")}>{form.completedCount} completed</span>
      </div>

      <div className="mt-3.5 flex items-center gap-1.5 border-t border-border pt-3">
        {!archived && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/hub/forms/${form.id}/edit`}><Pencil className="size-3.5" strokeWidth={2} aria-hidden /> Edit</Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={duplicate} disabled={pending}><Copy className="size-3.5" strokeWidth={2} aria-hidden /> Duplicate</Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={toggleArchive} disabled={pending} title={archived ? "Restore" : "Archive"}>
          {archived ? <ArchiveRestore className="size-3.5" strokeWidth={2} aria-hidden /> : <Archive className="size-3.5" strokeWidth={2} aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-2/30 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"><ClipboardList className="size-5" strokeWidth={1.9} aria-hidden /></span>
      <h3 className="mt-3 text-[15px] font-[640] text-text">No forms yet</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-2">Create your first form  an intake to greet new clients, or a feedback form to hear how a session went.</p>
      <Button asChild className="mt-5"><Link href="/hub/forms/new"><Plus className="size-4" strokeWidth={2} aria-hidden /> New form</Link></Button>
    </div>
  );
}
