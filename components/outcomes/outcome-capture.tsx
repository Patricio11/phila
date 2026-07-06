"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ShieldAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { recordOutcome } from "@/app/app/sessions/[id]/actions";
import { cn } from "@/lib/utils";

const OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

const PHQ9 = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself  or that you've let yourself or your family down",
  "Trouble concentrating on things",
  "Moving or speaking slowly, or being restless and fidgety",
  "Thoughts that you'd be better off not here, or of hurting yourself",
];

const GAD7 = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it's hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

type Tool = "PHQ-9" | "GAD-7";

function band(tool: Tool, score: number): string {
  if (tool === "PHQ-9") {
    if (score <= 4) return "Minimal";
    if (score <= 9) return "Mild";
    if (score <= 14) return "Moderate";
    if (score <= 19) return "Moderately severe";
    return "Severe";
  }
  if (score <= 4) return "Minimal";
  if (score <= 9) return "Mild";
  if (score <= 14) return "Moderate";
  return "Severe";
}

/** PHQ-9 / GAD-7 capture (Task 7.5). The validated instruments; severity is honest. */
export function OutcomeCaptureButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>("PHQ-9");
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const questions = tool === "PHQ-9" ? PHQ9 : GAD7;
  const score = Object.values(answers).reduce((s, v) => s + v, 0);
  const answeredAll = Object.keys(answers).length === questions.length;
  // PHQ-9 item 9 (index 8) is the safeguarding item.
  const safeguard = tool === "PHQ-9" && (answers[8] ?? 0) > 0;

  const reset = (t: Tool) => {
    setTool(t);
    setAnswers({});
  };

  const save = () => {
    start(async () => {
      const res = await recordOutcome({ clientId, tool, score });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `${tool} recorded`, description: `Score ${score} · ${band(tool, score)}. It joins ${clientName.split(" ")[0]}'s outcome trend.` });
      setOpen(false);
      setAnswers({});
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" className="w-full" onClick={() => setOpen(true)}>
        <ClipboardList className="size-4" strokeWidth={2} aria-hidden /> Record a measure
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record an outcome measure"
        description="Over the last two weeks, how often has the client been bothered by…"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-text-2">
              Score <span className="font-bold tabular-nums text-text">{score}</span>
              {answeredAll && <span className="ml-1.5 text-text-3">· {band(tool, score)}</span>}
            </span>
            <Button onClick={save} loading={pending} disabled={!answeredAll}>Save measure</Button>
          </div>
        }
      >
        <div className="mb-4 inline-flex rounded-control border border-border p-0.5">
          {(["PHQ-9", "GAD-7"] as Tool[]).map((t) => (
            <button key={t} type="button" onClick={() => reset(t)} className={cn("h-8 rounded-[6px] px-4 text-[12.5px] font-medium transition-colors", tool === t ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text")}>
              {t}
            </button>
          ))}
        </div>

        <ol className="space-y-4">
          {questions.map((q, i) => (
            <li key={i}>
              <div className="text-[13.5px] text-text">{i + 1}. {q}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {OPTIONS.map((opt, v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [i]: v }))}
                    aria-pressed={answers[i] === v}
                    className={cn("rounded-control border px-2 py-2 text-[11.5px] font-medium leading-tight transition-colors", answers[i] === v ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>

        {safeguard && (
          <div className="mt-5 flex items-start gap-2.5 rounded-control border border-danger/25 bg-danger-soft/50 p-3.5">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={2} aria-hidden />
            <p className="text-[12.5px] leading-relaxed text-text-2">
              This response needs a human follow-up. Stay with the client, involve your supervisor, and share current support  SADAG 0800 567 567. Never auto-actioned.
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
