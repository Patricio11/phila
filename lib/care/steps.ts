/**
 * Between-session "steps" progress + gentle achievements. Encouraging, never
 * competitive  no points, no streaks-that-shame. Pure + shared by the client
 * (their steps) and the counsellor (seeing what's been done).
 */
export interface StepTask {
  id: string;
  text: string;
  done: boolean;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  earned: boolean;
}

export interface StepProgress {
  done: number;
  total: number;
  pct: number;
  achievements: Achievement[];
}

export function stepProgress(tasks: StepTask[]): StepProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const ratio = total === 0 ? 0 : done / total;
  return {
    done,
    total,
    pct,
    achievements: [
      { id: "first", label: "First step", description: "You got started.", earned: done >= 1 },
      { id: "rhythm", label: "Finding your rhythm", description: "Halfway through your steps.", earned: total > 0 && ratio >= 0.5 },
      { id: "all", label: "All steps done", description: "Every step  beautifully done.", earned: total > 0 && done === total },
    ],
  };
}

/** A warm line for the current progress (no pressure). */
export function encourage(done: number, total: number): string {
  if (total === 0) return "Your counsellor will add a few gentle steps after your next session.";
  if (done === 0) return "Small steps, in your own time. There's no rush.";
  if (done === total) return "You've done everything this week  be proud of that. 🌱";
  return `${done} of ${total} done  you're moving at your own pace, and that's perfect.`;
}
