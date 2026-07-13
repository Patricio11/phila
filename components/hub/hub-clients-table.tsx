"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Inbox, Search, UserMinus, Undo2, X } from "lucide-react";
import type { CaseloadStatus, OrgClientRow } from "@/lib/data-provider";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusDot, type DotTone } from "@/components/ui/status-dot";
import { useToast } from "@/components/ui/toast";
import { reassignClient, removeClient, restoreClient } from "@/app/hub/clients/actions";
import { cn } from "@/lib/utils";

const STATUS: Record<CaseloadStatus, { label: string; tone: DotTone }> = {
  new: { label: "New", tone: "blue" },
  active: { label: "Active", tone: "green" },
  at_risk: { label: "Safeguarding", tone: "rose" },
  inactive: { label: "Inactive", tone: "grey" },
};

type Tab = "all" | CaseloadStatus | "removed";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "new", label: "New" },
  { key: "at_risk", label: "Safeguarding" },
  { key: "inactive", label: "Inactive" },
  { key: "removed", label: "Removed" },
];

const ALL_COUNSELLORS = "__all";

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));
}

export function HubClientsTable({ rows, removedRows, counsellors }: { rows: OrgClientRow[]; removedRows: OrgClientRow[]; counsellors: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [counsellorFilter, setCounsellorFilter] = useState<string>(ALL_COUNSELLORS);
  const [pending, start] = useTransition();

  // Reassign dialog state
  const [reassigning, setReassigning] = useState<OrgClientRow | null>(null);
  const [pickCounsellor, setPickCounsellor] = useState<string | null>(null);
  const [counsellorQuery, setCounsellorQuery] = useState("");
  // Remove confirmation state
  const [removeTarget, setRemoveTarget] = useState<OrgClientRow | null>(null);
  // Bulk multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReassign, setBulkReassign] = useState(false);
  const canSelect = tab !== "removed" && counsellors.length > 1;
  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSel = () => setSelected(new Set());

  // Source of truth is the DB  the server component re-reads on router.refresh().
  const liveRows = rows;
  const isRemoved = (r: OrgClientRow) => Boolean(r.client.deletedAt);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: liveRows.length, active: 0, new: 0, at_risk: 0, inactive: 0, removed: removedRows.length };
    for (const r of liveRows) c[r.status] += 1;
    return c;
  }, [liveRows, removedRows.length]);

  const base = tab === "removed" ? removedRows : tab === "all" ? liveRows : liveRows.filter((r) => r.status === tab);
  const shown = counsellorFilter === ALL_COUNSELLORS ? base : base.filter((r) => r.counsellorName === counsellorFilter);

  // ── Reassign ───────────────────────────────────────────────────────────
  const currentCounsellorId = reassigning ? counsellors.find((c) => c.name === reassigning.counsellorName)?.id ?? null : null;
  const filteredCounsellors = useMemo(() => {
    const t = counsellorQuery.trim().toLowerCase();
    return t ? counsellors.filter((c) => c.name.toLowerCase().includes(t)) : counsellors;
  }, [counsellorQuery, counsellors]);
  const openReassign = (r: OrgClientRow) => {
    setReassigning(r);
    setPickCounsellor(counsellors.find((c) => c.name === r.counsellorName)?.id ?? counsellors[0]?.id ?? null);
  };
  const openBulkReassign = () => {
    setBulkReassign(true);
    setPickCounsellor(counsellors[0]?.id ?? null);
  };
  const closeReassign = () => { setReassigning(null); setBulkReassign(false); setCounsellorQuery(""); };
  const confirmReassign = () => {
    if (!pickCounsellor) return;
    const ids = bulkReassign ? [...selected] : reassigning ? [reassigning.client.id] : [];
    if (ids.length === 0) return;
    const name = counsellors.find((c) => c.id === pickCounsellor)?.name ?? "";
    start(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await reassignClient({ clientId: id, counsellorId: pickCounsellor });
        if (res.ok) ok += 1;
      }
      if (ok === 0) return toast({ tone: "error", title: "Couldn't reassign  please try again." });
      toast({
        tone: "success",
        title: ids.length === 1 ? `${liveRows.find((r) => r.client.id === ids[0])?.client.name.split(" ")[0] ?? "Client"} reassigned` : `${ok} client${ok === 1 ? "" : "s"} reassigned`,
        description: `Now with ${name.split(" ")[0]}. History stays intact.`,
      });
      closeReassign();
      clearSel();
      router.refresh();
    });
  };

  // ── Remove / Restore ───────────────────────────────────────────────────
  const confirmRemove = () => {
    const r = removeTarget;
    if (!r) return;
    start(async () => {
      const res = await removeClient({ clientId: r.client.id });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setRemoveTarget(null);
      toast({ tone: "default", title: `${r.client.name.split(" ")[0]} moved to Removed`, description: "Nothing was deleted  open the Removed tab to restore them." });
      router.refresh();
    });
  };
  const restore = (r: OrgClientRow) => {
    start(async () => {
      const res = await restoreClient({ clientId: r.client.id });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `${r.client.name.split(" ")[0]} restored`, description: "Back on the active caseload." });
      router.refresh();
    });
  };

  const selectColumn: Column<OrgClientRow> = {
    key: "select",
    header: "",
    className: "w-9",
    render: (r) => (
      <Checkbox
        size="sm"
        ariaLabel={`Select ${r.client.name}`}
        checked={selected.has(r.client.id)}
        onChange={() => toggleSel(r.client.id)}
      />
    ),
  };

  const columns: Column<OrgClientRow>[] = [
    ...(canSelect ? [selectColumn] : []),
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
      render: (r) =>
        isRemoved(r) ? (
          <span className="inline-flex items-center gap-1.5 rounded-chip bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-text-3">Removed</span>
        ) : (
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
      render: (r) =>
        isRemoved(r) ? (
          <div className="flex justify-end">
            <Button variant="mini" onClick={() => restore(r)} disabled={pending}>
              <Undo2 className="size-3.5" strokeWidth={2} aria-hidden /> Restore
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-1.5">
            <Button variant="mini" onClick={() => openReassign(r)}>
              <ArrowLeftRight className="size-3.5" strokeWidth={2} aria-hidden /> Reassign
            </Button>
            <Button variant="mini" onClick={() => setRemoveTarget(r)}>
              <UserMinus className="size-3.5" strokeWidth={2} aria-hidden /> Remove
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Status tabs with live counts (the filter) */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.key];
          const danger = t.key === "at_risk" && count > 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); clearSel(); }}
              aria-pressed={active}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-accent bg-accent text-accent-ink"
                  : cn("border-border bg-surface hover:bg-surface-hover", danger ? "text-danger" : "text-text-2"),
              )}
            >
              {t.label}
              <span className={cn("tabular-nums", active ? "text-accent-ink/75" : "text-text-3")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Bulk action bar  appears when clients are selected. */}
      {canSelect && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-accent/30 bg-accent-soft/40 px-4 py-2.5">
          <span className="text-[13px] font-medium text-text">{selected.size} selected</span>
          {selected.size < shown.length && (
            <button type="button" onClick={() => setSelected(new Set(shown.map((r) => r.client.id)))} className="text-[12.5px] font-medium text-accent hover:underline">Select all {shown.length}</button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={openBulkReassign}>
              <ArrowLeftRight className="size-3.5" strokeWidth={2} aria-hidden /> Reassign
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSel}>
              <X className="size-3.5" strokeWidth={2} aria-hidden /> Clear
            </Button>
          </div>
        </div>
      )}

      {tab === "removed" && removedRows.length === 0 ? (
        <EmptyRemoved />
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(r) => r.client.id}
          search={{ placeholder: "Search clients…", getText: (r) => `${r.client.name} ${r.counsellorName} ${r.client.province}` }}
          toolbar={
            counsellors.length > 1 ? (
              <div className="w-48">
                <Select
                  value={counsellorFilter}
                  onChange={setCounsellorFilter}
                  options={[{ value: ALL_COUNSELLORS, label: "All counsellors" }, ...counsellors.map((c) => ({ value: c.name, label: c.name }))]}
                />
              </div>
            ) : undefined
          }
        />
      )}

      {/* Reassign  searchable counsellor picker (single or bulk) */}
      <Dialog
        open={Boolean(reassigning) || bulkReassign}
        onClose={closeReassign}
        title={bulkReassign ? `Reassign ${selected.size} client${selected.size === 1 ? "" : "s"}` : reassigning ? `Reassign ${reassigning.client.name}` : "Reassign"}
        description={bulkReassign ? "Move the selected clients to one counsellor. Each client's full history and outcomes move with them." : "Move this client to another counsellor. Their full history and outcomes move with them."}
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
                    className={cn("flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-left transition-colors", selected ? "bg-accent-soft" : "hover:bg-surface-hover")}
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

      {/* Remove  confirmation (nothing is destroyed) */}
      <Dialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Remove ${removeTarget.client.name}?` : "Remove"}
        description="This takes them off the active caseload  it doesn't delete anything."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={pending}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove} loading={pending}>Remove</Button>
          </div>
        }
      >
        <div className="flex items-start gap-3 rounded-control border border-border bg-surface-2/40 p-3.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-3">
            <UserMinus className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <p className="text-[13px] leading-relaxed text-text-2">
            Their full record  sessions, notes, outcomes, and invoices  is <span className="font-medium text-text">kept</span>, and your reporting stays accurate.
            They move to the <span className="font-medium text-text">Removed</span> tab, where you can <span className="font-medium text-text">restore</span> them any time.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function EmptyRemoved() {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-2/30 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-text-3">
        <Inbox className="size-5" strokeWidth={1.9} aria-hidden />
      </span>
      <h3 className="mt-3 text-[15px] font-[640] text-text">No removed clients</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-2">Anyone you remove from the active caseload lands here  their history intact  ready to restore.</p>
    </div>
  );
}
