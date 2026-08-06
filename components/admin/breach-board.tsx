"use client";

import { useState, useTransition } from "react";
import { Copy, Plus, ShieldAlert, Users } from "lucide-react";
import type { BreachView } from "@/db/queries/breaches";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { logBreach, updateBreachStatus, breachAffected } from "@/app/admin/compliance/actions";
import { cn } from "@/lib/utils";

/**
 * Phase 31.3 - the breach register (super-admin). Rare + admin-initiated:
 * log an incident, walk its status forward, and pull the affected-subjects
 * list + a drafted s22 notice when notification is needed.
 */
const SEVERITY_TONE: Record<string, string> = {
  low: "bg-surface-2 text-text-3", medium: "bg-info-soft text-info", high: "bg-warn-soft text-warn", critical: "bg-danger-soft text-danger",
};
const NEXT_STATUS: Record<string, string | null> = { open: "contained", contained: "notified", notified: "closed", closed: null };

export function BreachBoard({ breaches, orgs }: { breaches: BreachView[]; orgs: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ orgId: "", title: "", description: "", severity: "medium" as const, occurredAt: "", discoveredAt: "", containment: "" });
  const [affected, setAffected] = useState<{ id: string; subjects: { clientId: string; name: string; reachable: boolean }[]; draft: string } | null>(null);

  const submit = () => start(async () => {
    const res = await logBreach(form);
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setLogOpen(false);
    toast({ tone: "success", title: "Incident logged", description: "Recorded in the breach register." });
  });

  const advance = (b: BreachView) => start(async () => {
    const next = NEXT_STATUS[b.status];
    if (!next) return;
    const res = await updateBreachStatus({ id: b.id, status: next as "contained" });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: `Marked ${next}` });
  });

  const loadAffected = (b: BreachView) => start(async () => {
    const res = await breachAffected({ id: b.id });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setAffected({ id: b.id, subjects: res.subjects, draft: res.draft });
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-text-3">POPIA s22 register - log an incident, contain it, identify who was affected, notify. Rare by design.</p>
        <Button size="sm" onClick={() => setLogOpen(true)}><Plus className="size-4" strokeWidth={2} aria-hidden /> Log an incident</Button>
      </div>

      {breaches.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-8 text-center">
          <ShieldAlert className="mx-auto size-6 text-text-3" strokeWidth={1.8} aria-hidden />
          <p className="mt-2 text-[13.5px] font-[620] text-text">No incidents on record</p>
          <p className="mt-1 text-[12.5px] text-text-3">That&apos;s the goal. If one ever happens: log it here first, then contain, identify, notify.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {breaches.map((b) => (
            <li key={b.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold uppercase", SEVERITY_TONE[b.severity])}>{b.severity}</span>
                <span className="text-[13.5px] font-[640] text-text">{b.title}</span>
                <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-text-2">{b.status}</span>
                {b.orgName && <span className="text-[11.5px] text-text-3">· {b.orgName}</span>}
                <span className="ml-auto text-[11.5px] text-text-3">occurred {b.occurredAt.slice(0, 10)} · discovered {b.discoveredAt.slice(0, 10)}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">{b.description}</p>
              {b.containment && <p className="mt-1 text-[12px] text-text-3">Containment: {b.containment}</p>}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {NEXT_STATUS[b.status] && (
                  <Button variant="ghost" size="sm" onClick={() => advance(b)} disabled={pending}>Mark {NEXT_STATUS[b.status]}</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => loadAffected(b)} loading={pending && affected?.id !== b.id}>
                  <Users className="size-3.5" strokeWidth={2} aria-hidden /> Who was affected
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Log incident */}
      <Dialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log a breach incident"
        description="Record it first - containment and notification follow from here."
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setLogOpen(false)} disabled={pending}>Cancel</Button><Button onClick={submit} loading={pending}>Log incident</Button></div>}
      >
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Phishing attempt on a staff mailbox" /></div>
          <div className="space-y-1"><Label>What happened</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What, how it was found, what data may be in scope…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Severity</Label>
              <Select value={form.severity} onChange={(v) => setForm({ ...form, severity: v as typeof form.severity })} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "critical", label: "Critical" }]} />
            </div>
            <div className="space-y-1"><Label>Affected organisation (blank = platform-wide)</Label>
              <Select value={form.orgId} onChange={(v) => setForm({ ...form, orgId: v })} options={[{ value: "", label: "Platform-wide" }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]} />
            </div>
            <div className="space-y-1"><Label>Occurred</Label><DatePicker value={form.occurredAt} onChange={(v) => setForm({ ...form, occurredAt: v })} ariaLabel="Occurred on" /></div>
            <div className="space-y-1"><Label>Discovered</Label><DatePicker value={form.discoveredAt} onChange={(v) => setForm({ ...form, discoveredAt: v })} min={form.occurredAt || undefined} ariaLabel="Discovered on" /></div>
          </div>
          <div className="space-y-1"><Label>Containment so far (optional)</Label><Textarea rows={2} value={form.containment} onChange={(e) => setForm({ ...form, containment: e.target.value })} /></div>
        </div>
      </Dialog>

      {/* Affected + drafted notice */}
      <Dialog
        open={affected !== null}
        onClose={() => setAffected(null)}
        title="Affected data subjects"
        description="Derived from the audit trail inside the incident window. Review with the Information Officer; the draft below is a starting point, never auto-sent."
        footer={<div className="flex justify-end"><Button variant="ghost" onClick={() => setAffected(null)}>Close</Button></div>}
      >
        {affected && (
          <div className="space-y-3">
            <p className="text-[13px] text-text-2"><b className="text-text">{affected.subjects.length}</b> data subject{affected.subjects.length === 1 ? "" : "s"} had records accessed in the window{affected.subjects.length > 0 ? ` · ${affected.subjects.filter((s) => s.reachable).length} reachable` : ""}.</p>
            {affected.subjects.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-control border border-border bg-surface-2/40 p-2 text-[12.5px] text-text-2">
                {affected.subjects.map((s) => <li key={s.clientId}>{s.name}{s.reachable ? "" : " · no contact details"}</li>)}
              </ul>
            )}
            <div className="rounded-control border border-border bg-surface-2/40 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-3">Drafted s22 notice</span>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(affected.draft); }} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent"><Copy className="size-3" strokeWidth={2} aria-hidden /> Copy</button>
              </div>
              <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-2">{affected.draft}</pre>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
