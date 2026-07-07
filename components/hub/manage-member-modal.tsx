"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, SlidersHorizontal } from "lucide-react";
import type { TeamMemberView } from "@/lib/data-provider";
import { TEAM_ROLES, TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ROLE_REACH } from "@/components/hub/team-role-chip";
import { saveTeamMember, setMemberStatus } from "@/app/hub/team/actions";
import { cn } from "@/lib/utils";

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}

/** The role/supervision/access editor for one member  controlled by the caller. */
export function ManageMemberDialog({
  member,
  counsellorId = null,
  currentSupervisorId = null,
  supervisorOptions = [],
  open,
  onClose,
}: {
  member: TeamMemberView;
  counsellorId?: string | null;
  currentSupervisorId?: string | null;
  supervisorOptions?: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [teamRole, setTeamRole] = useState<TeamRole>(member.teamRole);
  const [isSupervisor, setIsSupervisor] = useState(member.isSupervisor);
  const [active, setActive] = useState(member.active);
  const [supervisorId, setSupervisorId] = useState<string | null>(currentSupervisorId);

  const cid = counsellorId ?? member.counsellorId ?? null;
  const canSupervise = teamRole === "counsellor";
  // A counsellor who isn't themselves a supervisor can be assigned one.
  const canBeSupervised = teamRole === "counsellor" && !(canSupervise && isSupervisor) && supervisorOptions.length > 0;
  const isInvited = member.status === "invited";

  const submit = () => {
    start(async () => {
      const res = await saveTeamMember({
        userId: member.userId,
        teamRole,
        isSupervisor: canSupervise && isSupervisor,
        counsellorId: cid,
        supervisorCounsellorId: canBeSupervised ? supervisorId : null,
      });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      // Access status is a separate capability boundary  only touch it if it changed.
      if (!isInvited && active !== member.active) {
        const s = await setMemberStatus({ userId: member.userId, status: active ? "active" : "archived" });
        if (!s.ok) return toast({ tone: "error", title: s.error });
      }
      toast({ tone: "success", title: `${member.name.split(" ")[0]} updated`, description: "Access changes take effect immediately." });
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Manage ${member.name}`}
      description={member.email}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={submit} loading={pending}>Save changes</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[12.5px] font-medium text-text-2">Org role</label>
          <Select value={teamRole} onChange={(v) => setTeamRole(v as TeamRole)} options={TEAM_ROLES.map((r) => ({ value: r, label: TEAM_ROLE_LABELS[r] }))} />
          <p className="text-[11.5px] text-text-3">{ROLE_REACH[teamRole]}</p>
        </div>

        <div className={cn("flex items-start gap-2.5 rounded-control border p-3", canSupervise ? "border-border" : "border-border/60 opacity-60")}>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text">Also a supervisor</div>
            <div className="text-[11.5px] text-text-2">Can read and sign off supervisees&apos; notes. Counsellors only.</div>
          </div>
          <Toggle on={canSupervise && isSupervisor} onClick={() => setIsSupervisor((v) => !v)} disabled={!canSupervise} />
        </div>

        {canBeSupervised && (
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium text-text-2">Reports to (clinical supervision)</label>
            <Select
              value={supervisorId ?? ""}
              onChange={(v) => setSupervisorId(v || null)}
              placeholder="No supervisor"
              options={[{ value: "", label: "No supervisor" }, ...supervisorOptions.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <p className="text-[11.5px] text-text-3">Their notes go to this supervisor for sign-off. Supervisors see only their supervisees.</p>
          </div>
        )}

        {isInvited ? (
          <div className="rounded-control border border-border bg-surface-2 px-3 py-2.5 text-[12px] text-text-2">
            This member hasn&apos;t accepted their invite yet. Set access once they join.
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-control border border-border p-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-text">{active ? "Active" : "Archived"}</div>
              <div className="text-[11.5px] text-text-2">Archiving revokes sign-in but keeps history and notes intact.</div>
            </div>
            <Toggle on={active} onClick={() => setActive((v) => !v)} />
          </div>
        )}

        {teamRole === "counsellor" && (
          <Link href="/hub/rooms" className="flex items-center gap-2 rounded-control bg-surface-2 px-3 py-2.5 text-[12.5px] text-text-2 transition-colors hover:bg-surface-hover">
            <CalendarClock className="size-4 text-text-3" strokeWidth={2} aria-hidden />
            Set this counsellor&apos;s room days &amp; times in <span className="font-medium text-accent">Rooms</span>
          </Link>
        )}
      </div>
    </Dialog>
  );
}

/** Convenience trigger + dialog, used on the member detail page. */
export function ManageMemberButton({
  member,
  counsellorId = null,
  currentSupervisorId = null,
  supervisorOptions = [],
  variant = "ghost",
  size = "sm",
  label = "Manage",
}: {
  member: TeamMemberView;
  counsellorId?: string | null;
  currentSupervisorId?: string | null;
  supervisorOptions?: { id: string; name: string }[];
  variant?: "ghost" | "primary" | "mini";
  size?: "sm" | "md";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant === "primary" ? undefined : variant} size={size === "md" ? undefined : "sm"} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" strokeWidth={2} aria-hidden /> {label}
      </Button>
      <ManageMemberDialog
        member={member}
        counsellorId={counsellorId}
        currentSupervisorId={currentSupervisorId}
        supervisorOptions={supervisorOptions}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
