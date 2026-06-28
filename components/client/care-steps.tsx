"use client";

import { useState, useTransition } from "react";
import { Award, BookOpen, Check, Sparkles, Sprout } from "lucide-react";
import { stepProgress, encourage, type StepTask } from "@/lib/care/steps";
import { useToast } from "@/components/ui/toast";
import { toggleStep } from "@/app/me/steps/actions";
import { cn } from "@/lib/utils";

const ACH_ICON: Record<string, typeof Sprout> = { first: Sprout, rhythm: Sparkles, all: Award };

function Ring({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="size-[72px] shrink-0 -rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} className="transition-[stroke-dashoffset] duration-500" />
      <text x="36" y="36" transform="rotate(90 36 36)" textAnchor="middle" dominantBaseline="central" className="fill-text text-[15px] font-bold">{pct}%</text>
    </svg>
  );
}

export function CareSteps({
  tasks: initial,
  resources = [],
  nextStep,
  counsellorFirstName,
}: {
  tasks: StepTask[];
  resources?: { label: string; note?: string }[];
  nextStep?: string | null;
  counsellorFirstName?: string;
}) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState(initial);
  const [, start] = useTransition();
  const { done, total, pct, achievements } = stepProgress(tasks);

  const toggle = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = !task.done;
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: next } : t));
    setTasks(updated);
    if (next) {
      const allDone = updated.every((t) => t.done);
      toast(allDone
        ? { tone: "success", title: "You did it 🎉", description: "Every step this week. Be proud of yourself." }
        : { tone: "success", title: "Nice one 🌱", description: "One step at a time." });
    }
    start(async () => {
      const res = await toggleStep({ taskId: id, done: next });
      if (!res.ok) { setTasks(tasks); toast({ tone: "error", title: res.error }); }
    });
  };

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-4 rounded-card border border-accent/20 bg-accent-soft/30 p-4">
        <Ring pct={pct} />
        <div className="min-w-0">
          <div className="text-[14px] font-[640] text-text">Your steps this week</div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-2">{encourage(done, total)}</p>
        </div>
      </div>

      {/* Steps */}
      {total > 0 && (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => toggle(t.id)}
                className={cn("flex w-full items-center gap-3 rounded-card border p-3.5 text-left transition-colors", t.done ? "border-accent/30 bg-accent-soft/40" : "border-border bg-surface hover:bg-surface-hover")}
              >
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all", t.done ? "border-accent bg-accent text-accent-ink" : "border-border-strong")}>
                  {t.done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                </span>
                <span className={cn("text-[14px] leading-snug", t.done ? "text-text-3 line-through" : "text-text")}>{t.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Achievements */}
      <div>
        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Moments to be proud of</div>
        <div className="grid grid-cols-3 gap-2.5">
          {achievements.map((a) => {
            const Icon = ACH_ICON[a.id] ?? Sprout;
            return (
              <div key={a.id} className={cn("rounded-card border p-3 text-center transition-colors", a.earned ? "border-accent/30 bg-accent-soft/40" : "border-dashed border-border bg-surface-2/30")}>
                <span className={cn("mx-auto inline-flex size-9 items-center justify-center rounded-full", a.earned ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-3")}>
                  <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <div className={cn("mt-1.5 text-[11.5px] font-medium leading-tight", a.earned ? "text-text" : "text-text-3")}>{a.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Counsellor's note */}
      {nextStep && (
        <div className="rounded-control border border-border bg-surface-2/40 p-3.5 text-[12.5px] leading-relaxed text-text-2">
          <span className="font-semibold text-text">{counsellorFirstName ? `${counsellorFirstName} says · ` : "Next time · "}</span>{nextStep}
        </div>
      )}

      {/* Resources */}
      {resources.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">
            <BookOpen className="size-3.5" strokeWidth={2} aria-hidden /> Things that might help
          </div>
          <ul className="space-y-1.5">
            {resources.map((r, i) => (
              <li key={i} className="rounded-control border border-border bg-surface p-3">
                <div className="text-[13px] font-medium text-text">{r.label}</div>
                {r.note && <div className="text-[12px] text-text-3">{r.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
