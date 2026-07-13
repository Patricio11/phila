"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  UserPlus, Search, MoreHorizontal, SlidersHorizontal, Archive, ArchiveRestore,
  Send, ArrowUpRight, Users,
} from "lucide-react";
import type { TeamMemberView, MemberStatus } from "@/lib/data-provider";
import { TEAM_ROLES, TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { useToast } from "@/components/ui/toast";
import { ROLE_REACH, TeamRoleChip } from "@/components/hub/team-role-chip";
import { RoleGuide } from "@/components/hub/role-guide";
import { ManageMemberDialog } from "@/components/hub/manage-member-modal";
import { inviteMember, setMemberStatus, sendSetupLink } from "@/app/hub/team/actions";
import { cn } from "@/lib/utils";

function joined(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "short", year: "numeric" }).format(new Date(iso));
}

type Tab = "active" | "invited" | "archived";

export function TeamBoard({ members }: { members: TeamMemberView[] }) {
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const counts = useMemo(() => ({
    active: members.filter((m) => m.status === "active").length,
    invited: members.filter((m) => m.status === "invited").length,
    archived: members.filter((m) => m.status === "archived").length,
  }), [members]);

  // Supervisors available to assign, for the quick-manage dialog.
  const supervisorOptions = useMemo(
    () => members.filter((m) => m.teamRole === "counsellor" && m.isSupervisor && m.counsellorId)
      .map((m) => ({ id: m.counsellorId as string, name: m.name })),
    [members],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => m.status === tab)
      .filter((m) => !q || `${m.name} ${m.email} ${TEAM_ROLE_LABELS[m.teamRole]}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, tab, query]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: counts.active },
    { key: "invited", label: "Invited", count: counts.invited },
    { key: "archived", label: "Archived", count: counts.archived },
  ];

  return (
    <div className="space-y-4">
      <RoleGuide />

      {/* No overflow-hidden here — it would clip the row ⋯ menus at the card edge. */}
      <div className="rounded-card border border-border bg-surface">
        {/* Toolbar: tabs + search + invite */}
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1 rounded-control bg-surface-2 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  tab === t.key ? "bg-surface text-text shadow-[var(--shadow-card)]" : "text-text-2 hover:text-text",
                )}
              >
                {t.label}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.key ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative sm:ml-auto sm:w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team…"
              className="h-9 w-full rounded-control border border-border bg-surface pl-8 pr-3 text-[13px] text-text placeholder:text-text-3 focus:border-accent/50 focus:outline-none"
            />
          </div>

          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Invite member
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyTab tab={tab} onInvite={() => setInviteOpen(true)} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((m) => (
              <MemberRow key={m.userId} member={m} supervisorOptions={supervisorOptions} />
            ))}
          </ul>
        )}
      </div>

      <InviteMember open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function MemberRow({ member: m, supervisorOptions }: { member: TeamMemberView; supervisorOptions: { id: string; name: string }[] }) {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <li className="group flex items-center gap-3 px-3.5 py-3 transition-colors last:rounded-b-card hover:bg-surface-hover">
      <Link href={`/hub/team/${m.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={m.name} size="sm" verified={m.credential?.status === "verified"} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-text group-hover:text-accent">{m.name}</div>
          <div className="truncate text-[11.5px] text-text-3">{m.email}</div>
        </div>
      </Link>

      {/* Role + reach */}
      <div className="hidden w-52 shrink-0 sm:block">
        <div className="flex items-center gap-1.5">
          <TeamRoleChip role={m.teamRole} />
          {m.isSupervisor && <span className="text-[11px] font-medium text-accent">+ supervisor</span>}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-text-3">{ROLE_REACH[m.teamRole]}</div>
      </div>

      {/* Credential / caseload */}
      <div className="hidden w-36 shrink-0 md:block">
        {m.credential ? (
          <CredentialChip body={m.credential.body} status={m.credential.status} />
        ) : m.teamRole === "counsellor" ? (
          <span className="text-[11.5px] text-text-3">No credential</span>
        ) : null}
        {typeof m.caseload === "number" && m.caseload > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-3">
            <Users className="size-3" strokeWidth={2} aria-hidden /> {m.caseload} {m.caseload === 1 ? "client" : "clients"}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="hidden w-24 shrink-0 lg:block">
        <StatusChip status={m.status} />
        <div className="mt-0.5 text-[10.5px] text-text-3">Since {joined(m.joinedAt)}</div>
      </div>

      <RowMenu member={m} onManage={() => setManageOpen(true)} />

      <ManageMemberDialog
        member={m}
        counsellorId={m.counsellorId ?? null}
        supervisorOptions={supervisorOptions}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </li>
  );
}

function StatusChip({ status }: { status: MemberStatus }) {
  const map: Record<MemberStatus, { label: string; cls: string; dot: string }> = {
    active: { label: "Active", cls: "text-accent", dot: "bg-accent" },
    invited: { label: "Invited", cls: "text-warn", dot: "bg-warn" },
    archived: { label: "Archived", cls: "text-text-3", dot: "bg-text-3" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", s.cls)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden /> {s.label}
    </span>
  );
}

function RowMenu({ member: m, onManage }: { member: TeamMemberView; onManage: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Open upward when the row sits near the bottom of the viewport, so the menu
  // is never cut off (the last rows of the list were clipping below the fold).
  const toggle = () => {
    if (!open && ref.current) {
      setOpenUp(window.innerHeight - ref.current.getBoundingClientRect().bottom < 240);
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const archive = () => start(async () => {
    const res = await setMemberStatus({ userId: m.userId, status: "archived" });
    setOpen(false);
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: `${m.name.split(" ")[0]} archived`, description: "Sign-in revoked. History is kept." });
  });

  const restore = () => start(async () => {
    const res = await setMemberStatus({ userId: m.userId, status: "active" });
    setOpen(false);
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: `${m.name.split(" ")[0]} restored`, description: "They can sign in again." });
  });

  const resend = () => start(async () => {
    const res = await sendSetupLink({ userId: m.userId });
    setOpen(false);
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Invite resent", description: `A fresh setup link is on its way to ${m.email}.` });
  });

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Actions for ${m.name}`}
        aria-expanded={open}
        className="grid size-8 place-items-center rounded-control text-text-3 transition-colors hover:bg-surface-2 hover:text-text"
      >
        <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div className={cn("absolute right-0 z-30 w-52 overflow-hidden rounded-control border border-border bg-surface p-1 shadow-[var(--shadow-card)]", openUp ? "bottom-full mb-1" : "top-full mt-1")}>
          <MenuLink href={`/hub/team/${m.userId}`} icon={ArrowUpRight}>Open profile</MenuLink>
          <MenuButton icon={SlidersHorizontal} onClick={() => { setOpen(false); onManage(); }}>Manage role &amp; access</MenuButton>
          {m.status === "invited" && (
            <MenuButton icon={Send} onClick={resend} disabled={pending}>Resend invite</MenuButton>
          )}
          <div className="my-1 h-px bg-border" />
          {m.status === "archived" ? (
            <MenuButton icon={ArchiveRestore} onClick={restore} disabled={pending}>Restore access</MenuButton>
          ) : (
            <MenuButton icon={Archive} onClick={archive} disabled={pending} tone="danger">
              {m.status === "invited" ? "Revoke invite" : "Archive member"}
            </MenuButton>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: typeof ArrowUpRight; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[12.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
      <Icon className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden /> {children}
    </Link>
  );
}

function MenuButton({ icon: Icon, onClick, disabled, tone, children }: { icon: typeof ArrowUpRight; onClick: () => void; disabled?: boolean; tone?: "danger"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[12.5px] transition-colors disabled:opacity-50",
        tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-text-2 hover:bg-surface-hover hover:text-text",
      )}
    >
      <Icon className={cn("size-4 shrink-0", tone === "danger" ? "text-danger" : "text-text-3")} strokeWidth={2} aria-hidden /> {children}
    </button>
  );
}

function EmptyTab({ tab, onInvite }: { tab: Tab; onInvite: () => void }) {
  const copy: Record<Tab, { title: string; body: string }> = {
    active: { title: "No active members", body: "Invite your first colleague to get started." },
    invited: { title: "No pending invites", body: "Everyone you've invited has joined." },
    archived: { title: "No archived members", body: "People you archive will appear here  their history stays intact." },
  };
  const c = copy[tab];
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-text-3">
        <Users className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <div>
        <div className="text-[13.5px] font-semibold text-text">{c.title}</div>
        <div className="mt-0.5 text-[12.5px] text-text-3">{c.body}</div>
      </div>
      {tab === "active" && (
        <Button size="sm" onClick={onInvite}>
          <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Invite member
        </Button>
      )}
    </div>
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
