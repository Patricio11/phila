"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, Check, Sparkles } from "lucide-react";
import type { CarePlan } from "@/lib/mock/types";
import { Card, CardHead } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * "From your counsellor" (Task 3.3) — the **shared** care plan, never the private
 * note (Care-Confidentiality Rule). Tasks the client can tick off: gentle, never
 * gamified, never pressuring. In Part A the tick is local + a toast; Phase 14/B
 * persists it back for the counsellor.
 */
export function CarePlanCard({
  plan,
  counsellorName,
}: {
  plan: CarePlan;
  counsellorName: string;
}) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState(plan.tasks);

  const toggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        toast({
          tone: done ? "success" : "default",
          title: done ? "Marked done" : "Marked as not done",
          description: done ? "No pressure — every small step counts." : undefined,
        });
        return { ...t, done };
      }),
    );
  };

  const sharedOn = plan.sharedAt
    ? new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long" }).format(
        new Date(plan.sharedAt),
      )
    : null;

  return (
    <Card>
      <CardHead
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" strokeWidth={2} aria-hidden />
            From {counsellorName.split(" ")[0]}
          </span>
        }
        action={sharedOn ? <span className="text-[11.5px] text-text-3">Shared {sharedOn}</span> : undefined}
      />
      <div className="space-y-5 px-[17px] pb-[17px]">
        <p className="text-[14px] leading-relaxed text-text-2">{plan.summary}</p>

        {tasks.length > 0 && (
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-text-3">
              Things to try
            </h3>
            <ul className="space-y-1.5">
              {tasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-pressed={t.done}
                    className="flex w-full items-start gap-3 rounded-control border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        t.done ? "border-accent bg-accent text-accent-ink" : "border-border-strong",
                      )}
                      aria-hidden
                    >
                      {t.done ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span
                      className={cn(
                        "text-[13.5px] leading-relaxed",
                        t.done ? "text-text-3 line-through" : "text-text",
                      )}
                    >
                      {t.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.resources.length > 0 && (
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-text-3">
              Helpful resources
            </h3>
            <ul className="space-y-1.5">
              {plan.resources.map((r) => (
                <li key={r.label} className="flex items-start gap-2.5 rounded-control bg-surface-2 p-3">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
                  <span>
                    <span className="block text-[13px] font-medium text-text">{r.label}</span>
                    {r.note ? <span className="block text-[12px] text-text-2">{r.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.nextStep && (
          <div className="flex items-start gap-2.5 rounded-control border border-accent/30 bg-accent-soft/40 p-3.5">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.2} aria-hidden />
            <span className="text-[13px] leading-relaxed text-text">{plan.nextStep}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
