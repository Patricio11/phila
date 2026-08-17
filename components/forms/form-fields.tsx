"use client";

import type { FormField } from "@/lib/domain/types";
import { FieldError, FieldHint, Input, Label, RadioGroup, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * The one renderer for a form's fields - used by the booking intake step, the hub
 * preview, and the client fill page. `readOnly` renders the exact client view
 * without accepting input (a preview); interactive mode takes values + onChange.
 * Because all three surfaces render through here, "preview == what the client
 * sees" is structural, not duplicated.
 *
 * Batch 2l - the full input set: short answer, paragraph, number, date, single
 * choice, dropdown, multi-select, linear scale (the K10 shape), plus two layout
 * blocks (statement, section) and an acknowledgement tick. Multi-answer values
 * (checkboxes) are stored as a "; "-joined string so answers stay a flat
 * Record<fieldId,string> everywhere - snapshots, exports and the DB all keep
 * working unchanged.
 */

export const MULTI_SEP = "; ";
export const splitMulti = (v: string): string[] => (v ? v.split(MULTI_SEP).filter(Boolean) : []);
export const joinMulti = (list: string[]): string => list.join(MULTI_SEP);

/**
 * Batch 4c - an option named "Other" (or "Other (please specify)", any case)
 * invites the client to say what, in their own words. The answer stays one
 * flat string - "Other: Sepedi" - so responses, exports and the PDF all read
 * naturally with no schema change.
 */
export const isOtherOption = (opt: string): boolean => /^other\b/i.test(opt.trim());
/** The typed detail, when `value` is "<opt>: <detail>". */
export const otherDetailOf = (opt: string, value: string): string =>
  value.startsWith(`${opt}:`) ? value.slice(opt.length + 1).trimStart() : "";
/** Which option a stored value answers (exact, or "<opt>: ..." for Other). */
const optionOf = (options: string[], value: string): string | null =>
  options.find((o) => value === o || (isOtherOption(o) && value.startsWith(`${o}:`))) ?? null;

export function FormFields({
  fields,
  values,
  errors,
  onChange,
  readOnly = false,
  idPrefix = "ff",
}: {
  fields: FormField[];
  values?: Record<string, string>;
  errors?: Record<string, string>;
  onChange?: (id: string, value: string) => void;
  readOnly?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const value = values?.[field.id] ?? "";
        const error = errors?.[field.id];
        const id = `${idPrefix}-${field.id}`;

        // ── Layout blocks: no label row, no answer ────────────────────────
        if (field.type === "section") {
          return (
            <div key={field.id} className="rounded-control bg-accent-soft/50 px-3.5 py-2.5">
              <div className="text-[13.5px] font-[680] text-text">{field.label}</div>
              {field.help && <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-2">{field.help}</p>}
            </div>
          );
        }
        if (field.type === "statement") {
          return (
            <div key={field.id} className="rounded-control border border-border bg-surface-2/40 px-3.5 py-3">
              <div className="text-[13px] font-[600] text-text">{field.label}</div>
              {field.help && <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-2">{field.help}</p>}
            </div>
          );
        }

        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={id} required={field.required} optional={!field.required}>
              {field.label}
            </Label>

            {field.type === "textarea" ? (
              <Textarea
                id={id}
                readOnly={readOnly}
                value={readOnly ? undefined : value}
                placeholder={field.placeholder}
                invalid={Boolean(error)}
                onChange={onChange ? (e) => onChange(field.id, e.target.value) : undefined}
              />
            ) : field.type === "radio" ? (
              (() => {
                const opts = field.options ?? [];
                const picked = optionOf(opts, value);
                return (
                  <div className="space-y-1.5">
                    <RadioGroup
                      options={opts}
                      value={picked ?? value}
                      readOnly={readOnly}
                      invalid={Boolean(error)}
                      onChange={(v) => onChange?.(field.id, v)}
                    />
                    {picked && isOtherOption(picked) && !readOnly && (
                      <Input
                        aria-label={`${field.label} - please specify`}
                        placeholder="Please specify..."
                        value={otherDetailOf(picked, value)}
                        onChange={(e) => onChange?.(field.id, e.target.value.trim() ? `${picked}: ${e.target.value}` : picked)}
                      />
                    )}
                  </div>
                );
              })()
            ) : field.type === "select" ? (
              (() => {
                const opts = field.options ?? [];
                const picked = optionOf(opts, value);
                return (
                  <div className="space-y-1.5">
                    <Select
                      id={id}
                      value={picked ?? (value || null)}
                      options={opts.map((o) => ({ value: o, label: o }))}
                      placeholder={field.placeholder || "Choose one"}
                      invalid={Boolean(error)}
                      onChange={(v) => onChange?.(field.id, v)}
                    />
                    {picked && isOtherOption(picked) && !readOnly && (
                      <Input
                        aria-label={`${field.label} - please specify`}
                        placeholder="Please specify..."
                        value={otherDetailOf(picked, value)}
                        onChange={(e) => onChange?.(field.id, e.target.value.trim() ? `${picked}: ${e.target.value}` : picked)}
                      />
                    )}
                  </div>
                );
              })()
            ) : field.type === "checkbox" ? (
              <CheckboxGroup
                options={field.options ?? []}
                value={value}
                readOnly={readOnly}
                maxChoices={field.maxChoices}
                onChange={(v) => onChange?.(field.id, v)}
              />
            ) : field.type === "scale" ? (
              <ScaleRow
                field={field}
                value={value}
                readOnly={readOnly}
                invalid={Boolean(error)}
                onChange={(v) => onChange?.(field.id, v)}
              />
            ) : field.type === "acknowledge" ? (
              <label className={cn("flex items-start gap-2.5 rounded-control border p-3 transition-colors", value === "yes" ? "border-accent bg-accent-soft/40" : "border-border", readOnly ? "cursor-default" : "cursor-pointer hover:bg-surface-hover")}>
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={value === "yes"}
                  onChange={(e) => onChange?.(field.id, e.target.checked ? "yes" : "")}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="text-[13px] leading-relaxed text-text-2">{field.placeholder || "I acknowledge"}</span>
              </label>
            ) : (
              <Input
                id={id}
                readOnly={readOnly}
                type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                inputMode={field.type === "tel" ? "tel" : field.type === "number" ? "numeric" : undefined}
                value={readOnly ? undefined : value}
                placeholder={field.placeholder}
                invalid={Boolean(error)}
                onChange={onChange ? (e) => onChange(field.id, e.target.value) : undefined}
              />
            )}

            {error ? <FieldError>{error}</FieldError> : field.help ? <FieldHint>{field.help}</FieldHint> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Multi-select. Values ride as a "; "-joined string (see MULTI_SEP). */
function CheckboxGroup({ options, value, onChange, readOnly, maxChoices }: {
  options: string[]; value: string; onChange: (v: string) => void; readOnly?: boolean; maxChoices?: number;
}) {
  const picked = splitMulti(value);
  const entryFor = (opt: string) => picked.find((p) => p === opt || (isOtherOption(opt) && p.startsWith(`${opt}:`)));
  const atCap = Boolean(maxChoices && maxChoices > 0 && picked.length >= maxChoices);
  const toggle = (opt: string) => {
    if (readOnly) return;
    const entry = entryFor(opt);
    const next = entry ? picked.filter((p) => p !== entry) : [...picked, opt];
    onChange(joinMulti(next));
  };
  const setOtherDetail = (opt: string, text: string) => {
    const entry = entryFor(opt);
    if (!entry) return;
    // The separator can't appear inside the detail - it would split the answer.
    const clean = text.replace(/;/g, ",");
    const nextEntry = clean.trim() ? `${opt}: ${clean}` : opt;
    onChange(joinMulti(picked.map((p) => (p === entry ? nextEntry : p))));
  };
  return (
    <div className="space-y-1.5">
      {options.map((opt) => {
        const entry = entryFor(opt);
        const on = Boolean(entry);
        return (
          <label
            key={opt}
            className={cn(
              "flex items-start gap-2.5 rounded-control border p-2.5 text-[13.5px] transition-colors",
              on ? "border-accent bg-accent-soft/40 text-text" : "border-border text-text-2",
              readOnly ? "cursor-default" : !on && atCap ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-hover",
            )}
          >
            <input
              type="checkbox"
              checked={on}
              disabled={readOnly || (!on && atCap)}
              onChange={() => toggle(opt)}
              className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0 flex-1 leading-snug">
              {opt}
              {on && isOtherOption(opt) && !readOnly && (
                <Input
                  aria-label={`${opt} - please specify`}
                  placeholder="Please specify..."
                  className="mt-1.5"
                  value={entry ? otherDetailOf(opt, entry) : ""}
                  onClick={(e) => e.preventDefault()}
                  onChange={(e) => setOtherDetail(opt, e.target.value)}
                />
              )}
            </span>
          </label>
        );
      })}
      {maxChoices ? <p className="text-[11px] text-text-3">Pick up to {maxChoices}.</p> : null}
    </div>
  );
}

/** A linear scale with end labels - the K10 / Likert shape. */
function ScaleRow({ field, value, onChange, readOnly, invalid }: {
  field: FormField; value: string; onChange: (v: string) => void; readOnly?: boolean; invalid?: boolean;
}) {
  const min = field.scale?.min ?? 1;
  const max = Math.max(min, field.scale?.max ?? 5);
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className={cn("rounded-control border p-3", invalid ? "border-danger" : "border-border")}>
      <div className="flex items-center gap-3">
        {field.scale?.minLabel && <span className="hidden shrink-0 text-[11.5px] text-text-3 sm:block">{field.scale.minLabel}</span>}
        <div className="flex flex-1 justify-between gap-1">
          {points.map((p) => {
            const on = value === String(p);
            return (
              <button
                key={p}
                type="button"
                disabled={readOnly}
                onClick={() => onChange(String(p))}
                aria-pressed={on}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
              >
                <span className="text-[11px] tabular-nums text-text-3">{p}</span>
                <span className={cn("grid size-6 place-items-center rounded-full border-2 transition-colors", on ? "border-accent bg-accent" : "border-border-strong")}>
                  {on && <span className="size-2 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
        {field.scale?.maxLabel && <span className="hidden shrink-0 text-[11.5px] text-text-3 sm:block">{field.scale.maxLabel}</span>}
      </div>
      {(field.scale?.minLabel || field.scale?.maxLabel) && (
        <div className="mt-1.5 flex justify-between text-[11px] text-text-3 sm:hidden">
          <span>{field.scale?.minLabel}</span><span>{field.scale?.maxLabel}</span>
        </div>
      )}
    </div>
  );
}
