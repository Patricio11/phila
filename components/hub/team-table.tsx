"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, UserPlus } from "lucide-react";
import type { TeamMemberView } from "@/lib/data-provider";
import { TEAM_ROLES, TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { CredentialChip } from "@/components/ui/credential-chip";
import { StatusDot } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";
import { ROLE_REACH, TeamRoleChip } from "@/components/hub/team-role-chip";
import { saveTeamMember, inviteMember } from "@/app/hub/team/actions";
import { cn } from "@/lib/utils";

function joined(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "short", year: "numeric" }).format(new Date(iso));
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}

export function TeamTable({ members: initial }: { members: TeamMemberView[] }) {
  const [members, setMembers] = useState(initial);
  const [managing, setManaging] = useState<TeamMemberView | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const columns: Column<TeamMemberView>[] = [
    {
      key: "name",
      header: "Member",
      sortValue: (m) => m.name,
      render: (m) => (
        <button type="button" onClick={() => setManaging(m)} className="group flex items-center gap-2.5 text-left">
          <Avatar name={m.name} size="sm" verified={m.credential?.status === "verified"} />
          <div className="min-w-0">
            <div className="font-medium text-text group-hover:text-accent group-hover:underline">{m.name}</div>
            <div className="truncate text-[11.5px] text-text-3">{m.email}</div>
          </div>
        </button>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (m) => m.teamRole,
      render: (m) => (
        <div>
          <TeamRoleChip role={m.teamRole} />
          {m.isSupervisor && <span className="ml-1.5 text-[11px] text-accent">+ supervisor</span>}
          <div className="mt-1 text-[11px] text-text-3">{ROLE_REACH[m.teamRole]}</div>
        </div>
      ),
    },
    {
      key: "credential",
      header: "Credential",
      hideBelow: "md",
      render: (m) => (m.credential ? <CredentialChip body={m.credential.body} status={m.credential.status} /> : <span className="text-text-3">—</span>),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (m) => (m.active ? 0 : 1),
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2">
          <StatusDot tone={m.active ? "green" : "grey"} /> {m.active ? "Active" : "Deactivated"}
        </span>
      ),
    },
    { key: "joined", header: "Joined", hideBelow: "lg", sortValue: (m) => m.joinedAt, render: (m) => <span className="text-text-3">{joined(m.joinedAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (m) => <Button variant="mini" onClick={() => setManaging(m)}>Manage</Button>,
    },
  ];

  return (
    <>
      <DataTable
        rows={members}
        columns={columns}
        rowKey={(m) => m.userId}
        search={{ placeholder: "Search team…", getText: (m) => `${m.name} ${m.email} ${m.teamRole}` }}
        toolbar={
          <Button size="sm" className="ml-auto" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Invite member
          </Button>
        }
      />

      {managing && (
        <ManageMember
          key={managing.userId}
          member={managing}
          onClose={() => setManaging(null)}
          onSaved={(next) => { setMembers((prev) => prev.map((x) => (x.userId === next.userId ? next : x))); setManaging(null); }}
        />
      )}

      <InviteMember open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}

function ManageMember({ member, onClose, onSaved }: { member: TeamMemberView; onClose: () => void; onSaved: (m: TeamMemberView) => void }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [teamRole, setTeamRole] = useState<TeamRole>(member.teamRole);
  const [isSupervisor, setIsSupervisor] = useState(member.isSupervisor);
  const [active, setActive] = useState(member.active);

  const canSupervise = teamRole === "counsellor";

  const submit = () => {
    start(async () => {
      const res = await saveTeamMember({ userId: member.userId, teamRole, isSupervisor: canSupervise && isSupervisor, active });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onSaved({ ...member, teamRole, isSupervisor: canSupervise && isSupervisor, active });
      toast({ tone: "success", title: `${member.name.split(" ")[0]} updated`, description: "Their access changes take effect immediately." });
    });
  };

  return (
    <Dialog
      open
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
          <Label>Org role</Label>
          <Select value={teamRole} onChange={(v) => setTeamRole(v as TeamRole)} options={TEAM_ROLES.map((r) => ({ value: r, label: TEAM_ROLE_LABELS[r] }))} />
          <p className="text-[11.5px] text-text-3">{ROLE_REACH[teamRole]}</p>
        </div>

        <div className={cn("flex items-start gap-2.5 rounded-control border p-3", canSupervise ? "border-border" : "border-border/60 opacity-60")}>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text">Also a supervisor</div>
            <div className="text-[11.5px] text-text-2">Can read and sign off their supervisees&apos; notes. Counsellors only.</div>
          </div>
          <Toggle on={canSupervise && isSupervisor} onClick={() => setIsSupervisor((v) => !v)} disabled={!canSupervise} />
        </div>

        <div className="flex items-start gap-2.5 rounded-control border border-border p-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text">{active ? "Active" : "Deactivated"}</div>
            <div className="text-[11.5px] text-text-2">Deactivating revokes sign-in but keeps their history and notes intact.</div>
          </div>
          <Toggle on={active} onClick={() => setActive((v) => !v)} />
        </div>

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

function InviteMember({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamRole, setTeamRole] = useState<TeamRole>("counsellor");

  const errors = {
    name: name.trim().length < 2 ? "Enter their name." : "",
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.email) return;
    start(async () => {
      const res = await inviteMember({ name: name.trim(), email, teamRole });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Invite sent", description: `${name.split(" ")[0]} will get an email to join as ${TEAM_ROLE_LABELS[teamRole].toLowerCase()}.` });
      onClose();
      setName(""); setEmail(""); setTeamRole("counsellor"); setAttempted(false);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a team member"
      description="They'll get an email to set their password. Their role sets what they can reach."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={submit} loading={pending}>Send invite</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kabelo Molefe" invalid={Boolean(attempted && errors.name)} />
          {attempted && errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@practice.co.za" invalid={Boolean(attempted && errors.email)} />
          {attempted && errors.email ? <FieldError>{errors.email}</FieldError> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Org role</Label>
          <Select value={teamRole} onChange={(v) => setTeamRole(v as TeamRole)} options={TEAM_ROLES.map((r) => ({ value: r, label: TEAM_ROLE_LABELS[r] }))} />
          <p className="text-[11.5px] text-text-3">{ROLE_REACH[teamRole]}</p>
        </div>
      </div>
    </Dialog>
  );
}
