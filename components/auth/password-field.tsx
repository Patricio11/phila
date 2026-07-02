"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function strength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(4, s);
  return { score, label: ["Too short", "Weak", "Okay", "Good", "Strong"][pw.length === 0 ? 0 : score] ?? "Weak" };
}

export function PasswordField({
  value,
  onChange,
  placeholder = "••••••••",
  invalid,
  autoComplete = "current-password",
  meter = false,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  autoComplete?: string;
  meter?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);
  const { score, label } = strength(value);
  const toneCls = ["bg-danger", "bg-danger", "bg-warn", "bg-accent", "bg-accent"][score] ?? "bg-border";

  return (
    <div>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          invalid={invalid}
          autoComplete={autoComplete}
          onKeyDown={onKeyDown}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
        >
          {show ? <EyeOff className="size-4" strokeWidth={2} aria-hidden /> : <Eye className="size-4" strokeWidth={2} aria-hidden />}
        </button>
      </div>
      {meter && value.length > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? toneCls : "bg-surface-2")} />
            ))}
          </div>
          <span className="text-[11px] text-text-3">{label}</span>
        </div>
      )}
    </div>
  );
}
