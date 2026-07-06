"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Download, FileText, Link2, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { exportGrantReport } from "@/app/hub/grants/[id]/actions";
import { inviteFunder } from "@/app/hub/funders/actions";
import { cn } from "@/lib/utils";

export function InviteFunderButton({ funders, grants }: { funders: { id: string; name: string }[]; grants: { id: string; title: string; funderId: string }[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);

  const [funderId, setFunderId] = useState<string | null>(funders[0]?.id ?? null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sentLink, setSentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const funderGrants = useMemo(() => grants.filter((g) => g.funderId === funderId), [grants, funderId]);

  const errors = {
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter the funder's email." : "",
    grants: picked.size === 0 ? "Pick at least one grant to share." : "",
  };

  const toggleGrant = (id: string) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const reset = () => { setEmail(""); setName(""); setPicked(new Set()); setAttempted(false); setSentLink(null); setCopied(false); };

  const send = () => {
    setAttempted(true);
    if (!funderId || errors.email || errors.grants) return;
    start(async () => {
      const res = await inviteFunder({ funderId, grantIds: [...picked].filter((id) => funderGrants.some((g) => g.id === id)), email: email.trim(), name: name.trim() });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setSentLink(`${origin}${res.path}`);
      toast({ tone: "success", title: "Funder invited", description: res.existing ? "Their portal now shows the selected grant(s)." : "Share the set-up link so they can sign in." });
    });
  };

  const copy = async () => {
    if (!sentLink) return;
    try { await navigator.clipboard.writeText(sentLink); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast({ tone: "error", title: "Couldn't copy  select the link manually." }); }
  };

  const close = () => { setOpen(false); reset(); };

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true); }}>
        <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Invite funder
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Invite a funder"
        description="Give a funder a read-only portal scoped to only the grant(s) you choose  aggregate, k-anonymised figures, never an individual."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>{sentLink ? "Done" : "Cancel"}</Button>
            {!sentLink && <Button onClick={send} loading={pending}>Send invite</Button>}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Funder</Label>
              <Select value={funderId} onChange={(v) => { setFunderId(v); setPicked(new Set()); }} options={funders.map((f) => ({ value: f.id, label: f.name }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact name <span className="text-text-3">(optional)</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Programme officer" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Funder email</Label>
            <Input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="funding@example.org" invalid={Boolean(attempted && errors.email)} />
            {attempted && errors.email ? <FieldError>{errors.email}</FieldError> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Share which grant(s)</Label>
            {funderGrants.length === 0 ? (
              <p className="rounded-control border border-dashed border-border px-3 py-3 text-[12.5px] text-text-3">This funder has no grants yet  create one first.</p>
            ) : (
              <div className="space-y-1">
                {funderGrants.map((g) => {
                  const on = picked.has(g.id);
                  return (
                    <button key={g.id} type="button" onClick={() => toggleGrant(g.id)} className={cn("flex w-full items-center gap-2.5 rounded-control border px-3 py-2 text-left text-[13px] transition-colors", on ? "border-accent bg-accent-soft/40 text-accent" : "border-border hover:bg-surface-hover")}>
                      <span className={cn("inline-flex size-4 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-ink" : "border-border-strong")}>{on && <Check className="size-3" strokeWidth={3} aria-hidden />}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {attempted && errors.grants ? <FieldError>{errors.grants}</FieldError> : null}
          </div>

          {sentLink && (
            <div className="rounded-control border border-dashed border-border bg-surface-2/40 p-3">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-text"><Link2 className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Set-up link</div>
              <p className="mt-1 text-[11.5px] text-text-3">Send this to the funder to set a password and open their read-only portal.</p>
              <div className="mt-2 flex items-center gap-2">
                <code suppressHydrationWarning className="min-w-0 flex-1 truncate rounded-chip bg-surface px-2.5 py-1.5 text-[11.5px] text-text-2">{sentLink}</code>
                <Button variant="subtle" size="sm" onClick={copy}>{copied ? <><Check className="size-4 text-accent" strokeWidth={2.4} aria-hidden /> Copied</> : <><Copy className="size-4" strokeWidth={2} aria-hidden /> Copy</>}</Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

export function ReportExport({ grantId }: { grantId: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (format: "pdf" | "csv") =>
    start(async () => {
      const res = await exportGrantReport({ grantId, format });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `Period report exported (${format.toUpperCase()})`, description: "k-anonymised  nothing identifiable, mapped to the funder's template." });
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" onClick={() => run("csv")} loading={pending}>
        <Download className="size-4" strokeWidth={2} aria-hidden /> CSV
      </Button>
      <Button onClick={() => run("pdf")} loading={pending}>
        <FileText className="size-4" strokeWidth={2} aria-hidden /> Funder report (PDF)
      </Button>
    </div>
  );
}
