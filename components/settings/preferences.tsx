"use client";

import { useState } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/use-theme";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Pref {
  key: string;
  label: string;
  description: string;
  on: boolean;
}

const INITIAL: Pref[] = [
  { key: "email", label: "Email notifications", description: "New bookings, cancellations, and reminders by email.", on: true },
  { key: "whatsapp", label: "WhatsApp notifications", description: "The same, on WhatsApp (when your org has it on).", on: true },
  { key: "daily", label: "Daily summary", description: "A morning email with your day's schedule.", on: false },
  { key: "team", label: "Team message alerts", description: "When a colleague or the hub messages you.", on: true },
];

export function Preferences() {
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState(INITIAL);

  const flip = (key: string) => {
    setPrefs((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        toast({ tone: "default", title: `${p.label} ${p.on ? "off" : "on"}` });
        return { ...p, on: !p.on };
      }),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">Notifications</h2>
        <div className="space-y-2.5">
          {prefs.map((p) => (
            <Row key={p.key} label={p.label} description={p.description} on={p.on} onToggle={() => flip(p.key)} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-text-3">Appearance</h2>
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-between gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-hover"
        >
          <div>
            <div className="text-[14px] font-[600] text-text">Theme</div>
            <div className="text-[12.5px] text-text-2">Currently {theme}. Switch any time.</div>
          </div>
          <span className="inline-flex size-9 items-center justify-center rounded-control bg-surface-2 text-text-2">
            {theme === "dark" ? <Sun className="size-[18px]" strokeWidth={1.9} aria-hidden /> : <Moon className="size-[18px]" strokeWidth={1.9} aria-hidden />}
          </span>
        </button>
      </div>
    </div>
  );
}

function Row({ label, description, on, onToggle }: { label: string; description: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-[600] text-text">{label}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={cn("mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-border-strong")}
      >
        <span className={cn("inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-4" : "translate-x-0")}>
          {on ? <Check className="size-3 text-accent" strokeWidth={3} aria-hidden /> : null}
        </span>
      </button>
    </div>
  );
}
