import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";
import type { ClientFormRow } from "@/lib/data-provider";
import { Tag } from "@/components/ui/tag";

/** A client's assigned forms (portal). Pending ones link out to the fill page. */
export function ClientForms({ forms }: { forms: ClientFormRow[] }) {
  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-2/30 px-6 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"><ClipboardList className="size-5" strokeWidth={1.9} aria-hidden /></span>
        <h3 className="mt-3 text-[15px] font-[640] text-text">No forms right now</h3>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-2">When your practice asks you to fill something in, it&apos;ll appear here.</p>
      </div>
    );
  }

  const pending = forms.filter((f) => f.status !== "completed");
  const completed = forms.filter((f) => f.status === "completed");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-2.5">
          {pending.map((f) => (
            <Link key={f.assignmentId} href={`/f/${f.token}`} className="group flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent/40">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent"><ClipboardList className="size-[18px]" strokeWidth={1.9} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-[620] text-text group-hover:text-accent">{f.formTitle}</div>
                <div className="text-[12px] text-text-3">Tap to fill in  a few minutes, kept confidential.</div>
              </div>
              <ArrowRight className="size-4 text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" strokeWidth={2} aria-hidden />
            </Link>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-text-3">Completed</h2>
          {completed.map((f) => (
            <div key={f.assignmentId} className="flex items-center gap-3 rounded-card border border-border bg-surface-2/40 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-3"><CheckCircle2 className="size-[18px] text-accent" strokeWidth={1.9} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-[620] text-text">{f.formTitle}</div>
                <div className="text-[12px] text-text-3">Submitted  thank you.</div>
              </div>
              <Tag tone="accent">Done</Tag>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
