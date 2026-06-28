"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Plus, Target } from "lucide-react";
import type { StepTask } from "@/lib/care/steps";
import { stepProgress } from "@/lib/care/steps";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addCarePlanStep } from "@/app/app/clients/actions";

export function CounsellorCareSteps({ clientId, clientFirstName, tasks: initial }: { clientId: string; clientFirstName: string; tasks: StepTask[] }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const { done, total } = stepProgress(tasks);

  const add = () => {
    const t = text.trim();
    if (t.length < 3) return;
    start(async () => {
      const res = await addCarePlanStep({ clientId, text: t });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setTasks((prev) => [...prev, { id: res.id, text: t, done: false }]);
      setText("");
      toast({ tone: "success", title: "Step added", description: `${clientFirstName} will see it in their portal.` });
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">
          <Target className="size-3.5" strokeWidth={2} aria-hidden /> Between-session steps
        </div>
        <span className="text-[11.5px] text-text-3">{done}/{total} done by {clientFirstName}</span>
      </div>

      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 text-[13px]">
            {t.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-text-3/50" strokeWidth={2} aria-hidden />}
            <span className={t.done ? "text-text-3 line-through" : "text-text-2"}>{t.text}</span>
          </li>
        ))}
        {tasks.length === 0 && <li className="text-[12.5px] text-text-3">No steps yet — add a gentle one below.</li>}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Add a step, e.g. “Take a short walk on heavy days”" className="flex-1" />
        <Button size="sm" onClick={add} loading={pending} disabled={text.trim().length < 3}>
          <Plus className="size-4" strokeWidth={2.2} aria-hidden /> Add
        </Button>
      </div>
    </div>
  );
}
