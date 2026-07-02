"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CalendarClock, Check, FileCheck2, PartyPopper, ShieldCheck, Upload } from "lucide-react";
import type { OnboardingRequirement } from "@/lib/data-provider";
import { PhilaMark } from "@/components/brand/logo";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

const DAYS = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" },
  { n: 4, label: "Thu" }, { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 7, label: "Sun" },
];
const STEPS = [
  { title: "Your practice", icon: Building2 },
  { title: "Working hours", icon: CalendarClock },
  { title: "Verification", icon: ShieldCheck },
  { title: "All set", icon: PartyPopper },
];

export function OnboardingWizard({ requirements }: { requirements: OnboardingRequirement[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);

  // Step state (local  Phase 10 persists to the org row).
  const [practice, setPractice] = useState({ name: "", email: "", phone: "", address: "" });
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hours, setHours] = useState({ start: "08:00", end: "17:00" });
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const requiredLeft = requirements.filter((r) => r.required && !uploaded[r.id]).length;

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => start(async () => {
    await completeOnboarding();
    router.push("/hub");
  });

  const onFile = (id: string): React.ChangeEventHandler<HTMLInputElement> => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploaded((p) => ({ ...p, [id]: file.name }));
    e.target.value = "";
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface-2/30">
      <header className="border-b border-border bg-surface px-5 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Phila home">
            <PhilaMark size={26} />
            <span className="text-[16px] font-[680] tracking-[-0.02em] text-text">Phila</span>
          </Link>
          <span className="text-[12.5px] text-text-3">Step {step + 1} of {STEPS.length}</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-7 sm:px-8">
        {/* Progress */}
        <div className="mb-7 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-1 items-center gap-1.5">
              <div className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-surface-2")} />
            </div>
          ))}
        </div>

        <div className="rise rounded-card border border-border bg-surface p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="inline-flex size-10 items-center justify-center rounded-chip bg-accent-soft text-accent">
              {(() => { const Icon = STEPS[step]!.icon; return <Icon className="size-[20px]" strokeWidth={2} aria-hidden />; })()}
            </span>
            <h1 className="text-[20px] font-[680] tracking-[-0.02em] text-text">{STEPS[step]!.title}</h1>
          </div>

          {/* STEP 0  practice */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-[13.5px] text-text-2">A few basics about your practice. You can change all of this later in Settings.</p>
              <div className="space-y-1.5"><Label>Practice name</Label><Input value={practice.name} onChange={(e) => setPractice((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Masizakhe Counselling" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Contact email</Label><Input inputMode="email" value={practice.email} onChange={(e) => setPractice((p) => ({ ...p, email: e.target.value }))} placeholder="admin@practice.co.za" /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input inputMode="tel" value={practice.phone} onChange={(e) => setPractice((p) => ({ ...p, phone: e.target.value }))} placeholder="011 234 5678" /></div>
              </div>
              <div className="space-y-1.5"><Label>Practice address</Label><Input value={practice.address} onChange={(e) => setPractice((p) => ({ ...p, address: e.target.value }))} placeholder="Street, suburb, city" /></div>
            </div>
          )}

          {/* STEP 1  hours */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[13.5px] text-text-2">When is your practice open? This shapes the calendar  closed days can&apos;t be booked.</p>
              <div>
                <Label>Working days</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const on = days.includes(d.n);
                    return <button key={d.n} type="button" onClick={() => setDays((p) => on ? p.filter((x) => x !== d.n) : [...p, d.n].sort())} className={cn("h-9 w-12 rounded-control border text-[12.5px] font-medium transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}>{d.label}</button>;
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
                <div className="space-y-1.5"><Label>Opens</Label><Input type="time" value={hours.start} onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Closes</Label><Input type="time" value={hours.end} onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))} /></div>
              </div>
            </div>
          )}

          {/* STEP 2  documents (admin-configured) */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[13.5px] text-text-2">Upload these so we can verify your practice. Your account works right away  <span className="font-medium text-text">verification unlocks payouts and funder sharing</span>.</p>
              <ul className="space-y-2">
                {requirements.map((r) => {
                  const done = Boolean(uploaded[r.id]);
                  return (
                    <li key={r.id} className={cn("flex items-start gap-3 rounded-control border p-3.5", done ? "border-accent/30 bg-accent-soft/30" : "border-border")}>
                      <span className={cn("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-chip", done ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-3")}>
                        {done ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : <FileCheck2 className="size-4" strokeWidth={2} aria-hidden />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13.5px] font-medium text-text">{r.label}</span>
                          <span className={cn("rounded-chip px-1.5 py-0.5 text-[10px] font-semibold", r.required ? "bg-warn-soft text-warn" : "bg-surface-2 text-text-3")}>{r.required ? "Required" : "Optional"}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-text-2">{done ? uploaded[r.id] : r.description}</p>
                      </div>
                      <input ref={(el) => { fileRefs.current[r.id] = el; }} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={onFile(r.id)} aria-hidden />
                      <Button variant="ghost" size="sm" onClick={() => fileRefs.current[r.id]?.click()}>
                        <Upload className="size-4" strokeWidth={2} aria-hidden /> {done ? "Replace" : "Upload"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {requiredLeft > 0 && <p className="text-[12px] text-text-3">{requiredLeft} required document{requiredLeft === 1 ? "" : "s"} still to upload  you can finish these later from Settings.</p>}
            </div>
          )}

          {/* STEP 3  done */}
          {step === 3 && (
            <div className="space-y-4 text-center">
              <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink"><PartyPopper className="size-7" strokeWidth={2} aria-hidden /></span>
              <div>
                <div className="text-[17px] font-[660] text-text">Your practice is ready 🎉</div>
                <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-text-2">
                  Welcome to Phila. Next, invite your counsellors, set up rooms and services, and you&apos;re running.
                  {requiredLeft > 0 ? " We'll review your documents and confirm verification soon." : " We'll review your documents and confirm verification soon."}
                </p>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="mt-7 flex items-center justify-between gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={back} disabled={pending}><ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back</Button>
            ) : <span />}
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>Continue <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden /></Button>
            ) : (
              <Button onClick={finish} loading={pending}>Go to your dashboard <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden /></Button>
            )}
          </div>
        </div>

        {step < STEPS.length - 1 && (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setStep(STEPS.length - 1)} className="text-[12.5px] text-text-3 hover:text-text-2 hover:underline">Skip for now</button>
          </div>
        )}
      </div>
    </div>
  );
}
