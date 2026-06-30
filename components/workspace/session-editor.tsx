"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  History,
  Lock,
  MapPin,
  Paperclip,
  Send,
  Sparkles,
  Target,
  Video,
} from "lucide-react";
import type { SessionEditorData } from "@/lib/data-provider";
import type { AppointmentState } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Card, CardHead } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import { SafeguardingPanel } from "@/components/workspace/safeguarding-panel";
import { OutcomeCaptureButton } from "@/components/outcomes/outcome-capture";
import { cn } from "@/lib/utils";
import {
  generateAiDraft,
  generateCarePlanDraft,
  markProgress,
  shareCarePlan,
  signNote,
  type AiExtraction,
} from "@/app/app/sessions/[id]/actions";

const PROGRESS: { state: AppointmentState; label: string }[] = [
  { state: "completed", label: "Completed" },
  { state: "no_show", label: "No-show" },
  { state: "postponed", label: "Postponed" },
];

// Note frameworks counsellors actually use  inserted as a scaffold, never forced.
const TEMPLATES: { key: string; label: string; body: string }[] = [
  { key: "soap", label: "SOAP", body: "Subjective:\n\nObjective:\n\nAssessment:\n\nPlan:\n" },
  { key: "dap", label: "DAP", body: "Data:\n\nAssessment:\n\nPlan:\n" },
  { key: "brief", label: "Brief", body: "Focus of session:\n\nWhat came up:\n\nAgreed next steps:\n" },
];

function sinceLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date} · ${time}`;
}

export function SessionEditor({
  data,
  counsellorName,
  videoEnabled,
}: {
  data: SessionEditorData;
  counsellorName: string;
  videoEnabled: boolean;
}) {
  const { appointment: appt, client, continuity } = data;
  const { toast } = useToast();

  const [body, setBody] = useState(data.note?.body ?? "");
  const [aiGenerated, setAiGenerated] = useState(data.note?.aiGenerated ?? false);
  const [signedAt, setSignedAt] = useState<string | null>(data.note?.signedAt ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(data.note ? "saved" : "idle");
  const [state, setState] = useState<AppointmentState>(appt.state);
  const [careSummary, setCareSummary] = useState(data.carePlan?.summary ?? "");
  const [extraction, setExtraction] = useState<AiExtraction | null>(null);

  const [generating, startGenerate] = useTransition();
  const [signing, startSign] = useTransition();
  const [marking, startMark] = useTransition();
  const [sharing, startShare] = useTransition();
  const [draftingCare, startDraftCare] = useTransition();
  const [attachments, setAttachments] = useState<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onAttach: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mock: attach to the session record. Phase 10 stores to Supabase (signed URL).
    setAttachments((prev) => [file.name, ...prev]);
    toast({ tone: "success", title: "Attached to this session", description: file.name });
    e.target.value = "";
  };

  // Local "autosave" indicator  never blocks typing. Phase 10 wires real autosave.
  const onBodyChange = (value: string) => {
    setBody(value);
    if (signedAt) setSignedAt(null); // editing after signing re-opens the draft
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState("saved"), 700);
  };

  const insertTemplate = (tpl: string) => onBodyChange(body.trim() ? `${body}\n\n${tpl}` : tpl);

  const onGenerate = () =>
    startGenerate(async () => {
      // The current note body is the counsellor's rough cues; the scribe shapes
      // them into a draft (de-identified before any model call) and replaces them.
      const res = await generateAiDraft({ appointmentId: appt.id, cues: body });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setBody(res.draft);
      setExtraction(res.extraction);
      setAiGenerated(true);
      setSignedAt(null);
      setSaveState("saved");
      toast({ tone: "success", title: "AI draft ready", description: "Review and edit it  you're the author. Sign when it's right." });
    });

  const onSign = () =>
    startSign(async () => {
      const res = await signNote({ appointmentId: appt.id, body });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setSignedAt(res.signedAt);
      toast({ tone: "success", title: "Note signed", description: "You're the author of record." });
    });

  const onMark = (next: AppointmentState) =>
    startMark(async () => {
      const res = await markProgress({ appointmentId: appt.id, state: next });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setState(next);
      toast({ tone: "success", title: `Marked ${PROGRESS.find((p) => p.state === next)?.label.toLowerCase() ?? next}` });
    });

  const onDraftCare = () =>
    startDraftCare(async () => {
      const res = await generateCarePlanDraft({ appointmentId: appt.id, cues: body });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setCareSummary(res.carePlan);
      toast({ tone: "success", title: "Care-plan draft ready", description: "Plain language for the client  edit before you share." });
    });

  const onShare = () =>
    startShare(async () => {
      const res = await shareCarePlan({ clientId: client.id, summary: careSummary });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `Shared with ${client.name.split(" ")[0]}`, description: "They'll see it in their portal  your private note stays private." });
    });

  return (
    <div className="rise space-y-5">
      <Link href="/app/sessions" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All sessions
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={client.name} size="lg" />
        <div className="min-w-0 flex-1">
          <Link href={`/app/clients/${client.id}`} className="text-[19px] font-[680] tracking-[-0.02em] text-text hover:text-accent">
            {client.name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-2">
            <span className="font-medium text-text-2">Session {continuity.sessionNumber}{continuity.totalSessions > continuity.sessionNumber ? ` of ${continuity.totalSessions}` : ""}</span>
            <span className="text-text-3">·</span>
            <span>{appt.serviceName}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5 text-text-3" strokeWidth={2} aria-hidden /> {whenLabel(appt.startsAt)}</span>
            <span className="inline-flex items-center gap-1">
              {appt.type === "online" ? <Video className="size-3.5 text-info" strokeWidth={2} aria-hidden /> : <MapPin className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />}
              {appt.type === "online" ? "Online" : (appt.roomName ?? "In person")}
            </span>
          </div>
        </div>
      </div>

      {client.riskFlag && <SafeguardingPanel clientName={client.name} />}

      {(continuity.previousDate || continuity.openGoals.length > 0) && (
        <Card>
          <CardHead
            title={<span className="flex items-center gap-2"><History className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Since last time</span>}
          />
          <div className="grid gap-4 px-[17px] pb-[17px] sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Last seen</div>
              {continuity.previousDate ? (
                <>
                  <p className="text-[12.5px] font-medium text-text">{sinceLabel(continuity.previousDate)}</p>
                  {continuity.previousSummary && <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{continuity.previousSummary}</p>}
                </>
              ) : (
                <p className="text-[12.5px] text-text-2">First session with {client.name.split(" ")[0]}  a clean start.</p>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
                <Target className="size-3.5" strokeWidth={2} aria-hidden /> Open goals
              </div>
              {continuity.openGoals.length > 0 ? (
                <ul className="space-y-1">
                  {continuity.openGoals.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] text-text-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />{g}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-text-3">No open goals on the care plan.</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Note  the private clinical note */}
        <Card className="lg:col-span-2">
          <CardHead
            title={
              <span className="flex items-center gap-2">
                <Lock className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Private clinical note
              </span>
            }
            action={<SaveBadge state={saveState} />}
          />
          <div className="space-y-3 px-[17px] pb-[17px]">
            <p className="text-[12px] text-text-3">
              Only you and your supervisor can read this. It&apos;s never shared with the client.
            </p>

            {aiGenerated && !signedAt && (
              <div className="inline-flex items-center gap-1.5 rounded-chip bg-warn-soft px-2 py-1 text-[11.5px] font-semibold text-warn">
                <Sparkles className="size-3.5" strokeWidth={2} aria-hidden /> AI-generated draft  edit before signing
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-3">Insert framework</span>
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" onClick={() => insertTemplate(t.body)} className="rounded-chip border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-2 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent">
                  {t.label}
                </button>
              ))}
            </div>

            <Textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Type your note as you talk  it autosaves and never blocks."
              className="min-h-[260px] text-[14px] leading-relaxed"
              aria-label="Private clinical note"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={onGenerate} loading={generating}>
                <Sparkles className="size-4" strokeWidth={2} aria-hidden /> Generate draft with AI
              </Button>
              <input ref={fileRef} type="file" className="hidden" onChange={onAttach} aria-hidden />
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                <Paperclip className="size-4" strokeWidth={2} aria-hidden /> Attach
              </Button>
              <Button onClick={onSign} loading={signing} disabled={!body.trim()} className="ml-auto">
                <Check className="size-4" strokeWidth={2.4} aria-hidden /> {signedAt ? "Re-sign note" : "Sign note"}
              </Button>
            </div>

            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((name, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-control bg-surface-2 px-3 py-2 text-[12.5px] text-text-2">
                    <Paperclip className="size-3.5 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
            )}

            {signedAt && (
              <div className="flex items-center gap-2 rounded-control bg-accent-soft/50 px-3 py-2 text-[12.5px] text-text-2">
                <Check className="size-4 text-accent" strokeWidth={2.4} aria-hidden />
                Signed by {counsellorName} ·{" "}
                {new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(signedAt))}
                {aiGenerated ? " · AI-assisted, edited and signed by you" : ""}
              </div>
            )}

            {extraction && (
              <div className="rounded-control border border-border bg-surface-2/60 p-3.5">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-2">
                  <Sparkles className="size-3.5 text-accent" strokeWidth={2} aria-hidden /> AI-extracted fields  feed reporting, zero double entry
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  <Extracted label="Presenting issue" value={extraction.presentingIssue} />
                  <Extracted label="Risk" value={extraction.risk} />
                  <Extracted label="Outcome" value={extraction.outcome} />
                  <Extracted label="Referral" value={extraction.referral} />
                </dl>
              </div>
            )}
          </div>
        </Card>

        {/* Side: progress + video + care plan */}
        <div className="space-y-5">
          {appt.type === "online" && (
            <Card className="p-4">
              <div className="text-[13px] font-[600] text-text">Online session</div>
              <p className="mt-1 text-[12px] text-text-2">
                {videoEnabled ? "Secure, in-region video room." : "This org uses its own meeting link."}
              </p>
              <Button asChild className="mt-3 w-full">
                <a href={`/room/${appt.id}`} target="_blank" rel="noopener noreferrer">
                  <Video className="size-4" strokeWidth={2} aria-hidden /> Open video room
                </a>
              </Button>
            </Card>
          )}

          <Card className="p-4">
            <div className="text-[13px] font-[600] text-text">Mark progress</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PROGRESS.map((p) => (
                <button
                  key={p.state}
                  type="button"
                  onClick={() => onMark(p.state)}
                  disabled={marking}
                  aria-pressed={state === p.state}
                  className={cn(
                    "h-9 rounded-control border text-[12.5px] font-medium transition-colors disabled:opacity-60",
                    state === p.state
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-surface text-text-2 hover:bg-surface-hover hover:text-text",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-text-3">AI never marks a session  only you do.</p>
          </Card>

          <Card className="p-4">
            <div className="text-[13px] font-[600] text-text">Outcome measure</div>
            <p className="mt-1 text-[12px] text-text-2">Capture a PHQ-9 or GAD-7 to track progress over time.</p>
            <div className="mt-3">
              <OutcomeCaptureButton clientName={client.name} />
            </div>
          </Card>

          <Card>
            <CardHead title="Share with the client" />
            <div className="space-y-3 px-[17px] pb-[17px]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] leading-relaxed text-text-3">
                  A separate care plan the client sees  advice, tasks, next steps. Your private note above
                  is never included.
                </p>
                <Button variant="mini" onClick={onDraftCare} loading={draftingCare} className="shrink-0">
                  <Sparkles className="size-3.5" strokeWidth={2} aria-hidden /> Draft with AI
                </Button>
              </div>
              <Textarea
                value={careSummary}
                onChange={(e) => setCareSummary(e.target.value)}
                placeholder="What would help between now and next time?"
                className="min-h-[120px]"
                aria-label="Care plan to share"
              />
              <Button variant="ghost" className="w-full" onClick={onShare} loading={sharing} disabled={!careSummary.trim()}>
                <Send className="size-4" strokeWidth={2} aria-hidden /> Share with client
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Extracted({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-3">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "idle") return null;
  return (
    <span className="text-[11.5px] text-text-3">
      {state === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
