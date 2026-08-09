"use client";

import type { FormField } from "@/lib/domain/types";
import { splitMulti } from "@/components/forms/form-fields";

/**
 * Batch 2l - a completed form, read back plainly: every question with the
 * client's answer, in the order they were asked. Renders from the assignment's
 * SNAPSHOT, so later edits to the form never rewrite what was actually answered.
 */
export function ResponseView({ fields, answers }: { fields: FormField[]; answers: Record<string, string> }) {
  return (
    <div className="space-y-4">
      {fields.map((f) => {
        if (f.type === "section") {
          return (
            <div key={f.id} className="border-b border-border pb-1.5 pt-2 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">
              {f.label}
            </div>
          );
        }
        if (f.type === "statement") return null;
        const raw = (answers[f.id] ?? "").trim();
        const answered = raw.length > 0;
        return (
          <div key={f.id}>
            <div className="text-[12.5px] text-text-3">{f.label}</div>
            {!answered ? (
              <div className="mt-0.5 text-[13.5px] italic text-text-3">Not answered</div>
            ) : f.type === "checkbox" ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {splitMulti(raw).map((v) => (
                  <span key={v} className="rounded-chip bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">{v}</span>
                ))}
              </div>
            ) : f.type === "scale" ? (
              <div className="mt-0.5 text-[13.5px] font-[600] text-text">
                {raw}<span className="text-text-3"> / {f.scale?.max ?? 5}</span>
                {f.scale?.minLabel && f.scale?.maxLabel && (
                  <span className="ml-2 text-[11.5px] font-normal text-text-3">{f.scale.minLabel} → {f.scale.maxLabel}</span>
                )}
              </div>
            ) : f.type === "acknowledge" ? (
              <div className="mt-0.5 text-[13.5px] font-[600] text-accent">Acknowledged</div>
            ) : (
              <div className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">{raw}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Total of every numeric scale answer - e.g. the K10 score. Null when none. */
export function scaleTotal(fields: FormField[], answers: Record<string, string>): { total: number; count: number } | null {
  const scales = fields.filter((f) => f.type === "scale");
  if (scales.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const f of scales) {
    const n = Number(answers[f.id]);
    if (Number.isFinite(n) && n > 0) { total += n; count += 1; }
  }
  return count > 0 ? { total, count } : null;
}
