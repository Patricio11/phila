"use client";

import { useState } from "react";
import { Ban, Play, Plus, UserCheck } from "lucide-react";
import type { PlatformOrgRow } from "@/lib/data-provider";
import type { SubscriptionStatus } from "@/lib/domain/enums";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const SUB: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-accent-soft text-accent" },
  trialing: { label: "Trial", cls: "bg-info-soft text-info" },
  past_due: { label: "Past due", cls: "bg-warn-soft text-warn" },
  cancelled: { label: "Cancelled", cls: "bg-surface-2 text-text-3" },
};

function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

export function OrgsTable({ rows }: { rows: PlatformOrgRow[] }) {
  const { toast } = useToast();
  const [suspended, setSuspended] = useState<Set<string>>(
    new Set(rows.filter((r) => r.org.suspended).map((r) => r.org.id)),
  );

  const columns: Column<PlatformOrgRow>[] = [
    {
      key: "name",
      header: "Organisation",
      sortValue: (r) => r.org.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.org.name} size="sm" />
          <div className="min-w-0">
            <div className="font-medium text-text">{r.org.name}</div>
            <div className="text-[11.5px] text-text-3">{r.org.province}</div>
          </div>
        </div>
      ),
    },
    { key: "plan", header: "Plan", sortValue: (r) => r.planName, render: (r) => <span className="text-text-2">{r.planName}</span> },
    {
      key: "status",
      header: "Billing",
      sortValue: (r) => r.org.subscriptionStatus,
      render: (r) => {
        const isSuspended = suspended.has(r.org.id);
        const s = SUB[r.org.subscriptionStatus];
        return (
          <span className={cn("inline-flex rounded-chip px-2 py-0.5 text-[11.5px] font-semibold", isSuspended ? "bg-surface-2 text-text-3" : s.cls)}>
            {isSuspended ? "Suspended" : s.label}
          </span>
        );
      },
    },
    { key: "members", header: "Members", align: "right", hideBelow: "md", sortValue: (r) => r.org.members, render: (r) => <span className="tabular-nums text-text-2">{r.org.members}</span> },
    { key: "sessions", header: "7d sessions", align: "right", hideBelow: "lg", sortValue: (r) => r.org.sessions7d, render: (r) => <span className="tabular-nums text-text-2">{r.org.sessions7d}</span> },
    { key: "ai", header: "AI spend", align: "right", hideBelow: "lg", sortValue: (r) => r.org.aiSpendCents, render: (r) => <span className="tabular-nums text-text-2">{rands(r.org.aiSpendCents)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => {
        const isSuspended = suspended.has(r.org.id);
        return (
          <div className="flex justify-end gap-1.5">
            <Button variant="mini" onClick={() => toast({ tone: "default", title: `Impersonating ${r.org.name}`, description: "This access is audited." })}>
              <UserCheck className="size-3.5" strokeWidth={2} aria-hidden /> Impersonate
            </Button>
            <Button
              variant="mini"
              onClick={() => {
                setSuspended((prev) => {
                  const next = new Set(prev);
                  if (isSuspended) next.delete(r.org.id);
                  else next.add(r.org.id);
                  return next;
                });
                toast({ tone: "default", title: isSuspended ? `${r.org.name} restored` : `${r.org.name} suspended`, description: "Recorded in the audit ledger." });
              }}
            >
              {isSuspended ? <Play className="size-3.5" strokeWidth={2} aria-hidden /> : <Ban className="size-3.5" strokeWidth={2} aria-hidden />}
              {isSuspended ? "Restore" : "Suspend"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.org.id}
      search={{ placeholder: "Search organisations…", getText: (r) => `${r.org.name} ${r.org.province} ${r.planName}` }}
      toolbar={
        <Button size="sm" className="ml-auto" onClick={() => toast({ tone: "default", title: "Create organisation", description: "Set up an org, its plan, and its first admin." })}>
          <Plus className="size-4" strokeWidth={2} aria-hidden /> Create org
        </Button>
      }
    />
  );
}
