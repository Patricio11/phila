"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, Search, UserMinus } from "lucide-react";
import type { CaseloadStatus, OrgClientRow } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";
import { reassignClient } from "@/app/hub/clients/actions";
import { cn } from "@/lib/utils";

const STATUS: Record<CaseloadStatus, { label: string; tone: DotTone }> = {
  new: { label: "New", tone: "blue" },
  active: { label: "Active", tone: "green" },
  at_risk: { label: "Safeguarding", tone: "rose" },
  inactive: { label: "Inactive", tone: "grey" },
};

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
}

export function HubClientsTable({ rows, counsellors }: { rows: OrgClientRow[]; counsellors: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [reassigning, setReassigning] = useState<OrgClientRow | null>(null);
  const [pickCounsellor, setPickCounsellor] = useState<string | null>(null);
  const [counsellorQuery, setCounsellorQuery] = useState("");
  const [pending, start] = useTransition();

  const currentCounsellorId = reassigning ? counsellors.find((c) => c.name === reassigning.counsellorName)?.id ?? null : null;
  const filteredCounsellors = useMemo(() => {
    const t = counsellorQuery.trim().toLowerCase();
    return t ? counsellors.filter((c) => c.name.toLowerCase().includes(t)) : counsellors;
  }, [counsellorQuery, counsellors]);
  const closeReassign = () => { setReassigning(null); setCounsellorQuery(""); };

  const shown = rows
    .filter((r) => !removed.has(r.client.id))
    .map((r) => (assignments[r.client.id] ? { ...r, counsellorName: assignments[r.client.id]! } : r));

  const openReassign = (r: OrgClientRow) => {
    setReassigning(r);
    setPickCounsellor(counsellors.find((c) => c.name === r.counsellorName)?.id ?? counsellors[0]?.id ?? null);
  };

  const confirmReassign = () => {
    if (!reassigning || !pickCounsellor) return;
    start(async () => {
      const res = await reassignClient({ clientId: reassigning.client.id, counsellorId: pickCounsellor });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const name = counsellors.find((c) => c.id === pickCounsellor)?.name ?? "";
      setAssignments((prev) => ({ ...prev, [reassigning.client.id]: name }));
      toast({ tone: "success", title: `${reassigning.client.name.split(" ")[0]} reassigned`, description: `Now with ${name.split(" ")[0]}. History stays intact.` });
      closeReassign();
    });
  };

  const columns: Column<OrgClientRow>[] = [
    {
      key: "name",
      header: "Client",
      sortValue: (r) => r.client.name,
      render: (r) => (
        <Link href={`/hub/clients/${r.client.id}`} className="group flex items-center gap-2.5">
          <Avatar name={r.client.name} size="sm" />
          <span className="font-medium text-text group-hover:text-accent group-hover:underline">{r.client.name}</span>
        </Link>
      ),
    },
    { key: "counsellor", header: "Counsellor", sortValue: (r) => r.counsellorName, render: (r) => <span className="text-text-2">{r.counsellorName}</span> },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2">
          <StatusDot tone={STATUS[r.status].tone} /> {STATUS[r.status].label}
        </span>
      ),
    },
    { key: "next", header: "Next", hideBelow: "md", sortValue: (r) => r.nextSession?.startsAt ?? "9999", render: (r) => <span className="text-text-2">{shortDate(r.nextSession?.startsAt)}</span> },
    { key: "last", header: "Last seen", hideBelow: "lg", sortValue: (r) => r.lastSession?.startsAt ?? "0", render: (r) => <span className="text-text-2">{shortDate(r.lastSession?.startsAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="mini" onClick={() => openReassign(r)}>
            <ArrowLeftRight className="size-3.5" strokeWidth={2} aria-hidden /> Reassign
          </Button>
          <Button
            variant="mini"
            onClick={() => {
              setRemoved((prev) => new Set(prev).add(r.client.id));
              toast({ tone: "default", title: `${r.client.name.split(" ")[0]} removed from the active list`, description: "Their stats are preserved  reporting stays accurate." });
            }}
          >
            <UserMinus className="size-3.5" strokeWidth={2} aria-hidden /> Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={shown}
        columns={columns}
        rowKey={(r) => r.client.id}
        search={{ placeholder: "Search clients…", getText: (r) => `${r.client.name} ${r.counsellorName} ${r.client.province}` }}
      />

      <Dialog
        open={Boolean(reassigning)}
        onClose={closeReassign}
        title={reassigning ? `Reassign ${reassigning.client.name}` : "Reassign"}
        description="Move this client to another counsellor. Their full history and outcomes move with them."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeReassign} disabled={pending}>Cancel</Button>
            <Button onClick={confirmReassign} loading={pending} disabled={!pickCounsellor}>Reassign</Button>
          </div>
        }
      >
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
            <Input value={counsellorQuery} onChange={(e) => setCounsellorQuery(e.target.value)} placeholder="Search counsellors…" className="pl-9" />
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {filteredCounsellors.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-text-3">No counsellors found.</p>
            ) : (
              filteredCounsellors.map((c) => {
                const selected = c.id === pickCounsellor;
                const isCurrent = c.id === currentCounsellorId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPickCounsellor(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-left transition-colors",
                      selected ? "bg-accent-soft" : "hover:bg-surface-hover",
                    )}
                  >
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate text-[13.5px] font-medium", selected ? "text-accent" : "text-text")}>{c.name}</div>
                      {isCurrent && <div className="text-[11px] text-text-3">Current counsellor</div>}
                    </div>
                    {selected && <Check className="size-4 shrink-0 text-accent" strokeWidth={2.4} aria-hidden />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
