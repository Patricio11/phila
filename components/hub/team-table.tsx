"use client";

import { UserPlus } from "lucide-react";
import type { TeamMemberView } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CredentialChip } from "@/components/ui/credential-chip";
import { StatusDot } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";
import { ROLE_REACH, TeamRoleChip } from "@/components/hub/team-role-chip";

function joined(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "short", year: "numeric" }).format(new Date(iso));
}

export function TeamTable({ members }: { members: TeamMemberView[] }) {
  const { toast } = useToast();

  const columns: Column<TeamMemberView>[] = [
    {
      key: "name",
      header: "Member",
      sortValue: (m) => m.name,
      render: (m) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={m.name} size="sm" verified={m.credential?.status === "verified"} />
          <div className="min-w-0">
            <div className="font-medium text-text">{m.name}</div>
            <div className="truncate text-[11.5px] text-text-3">{m.email}</div>
          </div>
        </div>
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
      render: (m) =>
        m.credential ? (
          <CredentialChip body={m.credential.body} status={m.credential.status} />
        ) : (
          <span className="text-text-3">—</span>
        ),
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
    {
      key: "joined",
      header: "Joined",
      hideBelow: "lg",
      sortValue: (m) => m.joinedAt,
      render: (m) => <span className="text-text-3">{joined(m.joinedAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (m) => (
        <Button
          variant="mini"
          onClick={() => toast({ tone: "default", title: `Manage ${m.name.split(" ")[0]}`, description: "Set role, supervisor, and room schedule here." })}
        >
          Manage
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      rows={members}
      columns={columns}
      rowKey={(m) => m.userId}
      search={{ placeholder: "Search team…", getText: (m) => `${m.name} ${m.email} ${m.teamRole}` }}
      toolbar={
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => toast({ tone: "default", title: "Invite a team member", description: "Send an email invite and set their org role." })}
        >
          <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Invite member
        </Button>
      }
    />
  );
}
