"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowRightLeft, CalendarX, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchSelect } from "@/components/ui/search-select";
import { useToast } from "@/components/ui/toast";
import { offboardMember } from "@/app/hub/team/actions";
import { cn } from "@/lib/utils";

/**
 * Feedback #4 — archiving a counsellor, done properly. The dialog shows the
 * honest workload, forces ONE choice (migrate everything to a successor, or
 * cancel the upcoming sessions), and states our record-keeping truth plainly:
 * sign-in is revoked but NOTHING is deleted — notes, sessions, outcomes and
 * the audit trail stay on record permanently (HPCSA).
 */
export function OffboardMemberDialog({
  open,
  onClose,
  member,
  workload,
  counsellorOptions,
}: {
  open: boolean;
  onClose: () => void;
  member: { userId: string; name: string };
  workload: { counsellorId: string | null; upcoming: number; clients: number };
  counsellorOptions: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const hasWork = Boolean(workload.counsellorId) && (workload.upcoming > 0 || workload.clients > 0);
  const [mode, setMode] = useState<"migrate" | "cancel">("migrate");
  const [successor, setSuccessor] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const first = member.name.split(" ")[0];
  const successors = counsellorOptions.filter((c) => c.id !== workload.counsellorId);
  const canConfirm = acknowledged && (!hasWork || mode === "cancel" || (mode === "migrate" && successor));

  const confirm = () => start(async () => {
    const res = await offboardMember({
      userId: member.userId,
      mode: hasWork ? mode : "none",
      toCounsellorId: mode === "migrate" ? successor ?? undefined : undefined,
    });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    onClose();
    toast({ tone: "success", title: `${first} archived`, description: res.summary });
    router.refresh();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Archive ${member.name}`}
      description={hasWork
        ? `${first} has ${workload.upcoming} upcoming session${workload.upcoming === 1 ? "" : "s"} and ${workload.clients} client${workload.clients === 1 ? "" : "s"} in their care — decide what happens to them first.`
        : `${first} has no upcoming sessions or assigned clients.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={confirm} loading={pending} disabled={!canConfirm} className="bg-danger hover:bg-danger/90">
            <Archive className="size-4" strokeWidth={2} aria-hidden />
            {hasWork ? (mode === "migrate" ? "Archive & move everything" : "Archive & cancel sessions") : "Archive member"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {hasWork && (
          <div className="space-y-2">
            <Choice
              on={mode === "migrate"}
              onClick={() => setMode("migrate")}
              icon={ArrowRightLeft}
              title="Move everything to another counsellor"
              badge="Recommended"
              body="Their clients and every upcoming session transfer across. Anything that clashes with the new counsellor's diary is flagged for rebooking instead of failing."
            >
              {mode === "migrate" && (
                <div className="mt-2.5">
                  <SearchSelect
                    avatars
                    value={successor}
                    onChange={setSuccessor}
                    placeholder="Choose who takes over"
                    searchPlaceholder="Search counsellors…"
                    ariaLabel="Successor counsellor"
                    options={successors.map((c) => ({ value: c.id, label: c.name, hint: "Counsellor" }))}
                  />
                </div>
              )}
            </Choice>
            <Choice
              on={mode === "cancel"}
              onClick={() => setMode("cancel")}
              icon={CalendarX}
              title="Cancel their upcoming sessions"
              body="Clients are notified through your messaging channels (where switched on). Their clients stay on the books, unassigned, for you to re-place later."
            />
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface-2/40 p-3">
          <Checkbox checked={acknowledged} onChange={setAcknowledged} ariaLabel="Acknowledge record keeping" className="mt-0.5" />
          <span className="text-[12.5px] leading-relaxed text-text-2">
            I understand {first}&apos;s <b className="text-text">sign-in is revoked</b> but <b className="text-text">nothing is deleted</b> — their signed notes, sessions, outcomes and audit history stay on the practice record permanently, as the law requires. They can be restored at any time.
          </span>
        </label>

        <p className="flex items-center gap-1.5 text-[11.5px] text-text-3">
          <ShieldCheck className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> Records are kept under HPCSA retention rules — archiving never destroys history.
        </p>
      </div>
    </Dialog>
  );
}

function Choice({ on, onClick, icon: Icon, title, body, badge, children }: {
  on: boolean; onClick: () => void; icon: typeof Archive; title: string; body: string; badge?: string; children?: React.ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={cn("cursor-pointer rounded-control border p-3 transition-colors", on ? "border-accent bg-accent-soft/30" : "border-border bg-surface hover:bg-surface-hover")}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-accent text-white" : "bg-surface-2 text-text-3")}>
          <Icon className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-[13.5px] font-[620]", on ? "text-accent" : "text-text")}>{title}</span>
            {badge && <span className="rounded-chip bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">{badge}</span>}
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-text-2">{body}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
