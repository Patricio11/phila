import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Form inputs (DESIGN.md §6)  labelled fields, accent focus ring, inline
 * validation. Quiet by default; the only "loud" affordance is the focus ring.
 */
const fieldBase =
  "w-full rounded-control border bg-surface px-3 text-[14px] text-text placeholder:text-text-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, "h-11", invalid ? "border-danger" : "border-border", className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        "min-h-[96px] resize-y py-2.5 leading-relaxed",
        invalid ? "border-danger" : "border-border",
        className,
      )}
      {...props}
    />
  );
});

export function Label({
  children,
  htmlFor,
  required,
  optional,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-[13.5px] font-medium text-text", className)}>
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
      {optional && <span className="ml-1.5 text-[11.5px] font-normal text-text-3">optional</span>}
    </label>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-snug text-text-3">{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[12px] font-medium text-danger">
      {children}
    </p>
  );
}

/**
 * A radio group rendered as selectable cards  accessible, touch-friendly, and
 * avoids a native select (DESIGN.md §6: never native). ≥ 44px targets.
 */
export function RadioGroup({
  options,
  value,
  onChange,
  invalid,
  readOnly,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  /** Preview mode  the cards render exactly as a client sees them, but don't select. */
  readOnly?: boolean;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={readOnly}
            onClick={() => onChange(opt)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-control border px-3.5 text-[13.5px] font-medium transition-colors",
              readOnly && "cursor-default",
              selected
                ? "border-accent bg-accent-soft text-accent"
                : invalid
                  ? "border-danger text-text-2 hover:bg-surface-hover"
                  : readOnly
                    ? "border-border bg-surface text-text-2"
                    : "border-border bg-surface text-text-2 hover:bg-surface-hover hover:text-text",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
