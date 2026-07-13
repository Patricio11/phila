"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { GRANT_STATUSES, REPORTING_SCHEDULES, type GrantStatus } from "@/lib/domain/enums";
import type { IndicatorMetric } from "@/lib/domain/types";
import { INDICATOR_CATALOGUE, indicatorMeta } from "@/lib/domain/indicator-catalogue";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input, Label, FieldError } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createGrant, updateGrant } from "@/app/hub/funders/actions";
import { cn } from "@/lib/utils";

const SCHEDULE_LABELS: Record<(typeof REPORTING_SCHEDULES)[number], string> = { monthly: "Monthly", quarterly: "Quarterly", biannual: "Twice a year", annual: "Annual" };
const STATUS_LABELS: Record<GrantStatus, string> = { pending: "Pending", active: "Active", closed: "Closed" };

type Row = { key: string; metric: IndicatorMetric; target: number };
type GrantInit = {
  id: string; funderId: string; title: string; periodStart: string; periodEnd: string;
  amountCents: number; restricted: boolean; reportingSchedule: (typeof REPORTING_SCHEDULES)[number]; status: GrantStatus;
  indicators: { metric: IndicatorMetric; target: number }[];
};

export function GrantFormButton({ funders, grant, trigger }: { funders: { id: string; name: string }[]; grant?: GrantInit; trigger?: "primary" | "edit" }) {
  const { toast } = useToast();
  const router = useRouter();
  const editing = Boolean(grant);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const keySeq = useRef(0);

  const [funderId, setFunderId] = useState<string | null>(grant?.funderId ?? funders[0]?.id ?? null);
  const [title, setTitle] = useState(grant?.title ?? "");
  const [periodStart, setPeriodStart] = useState(grant?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(grant?.periodEnd ?? "");
  const [amount, setAmount] = useState<string>(grant ? String(Math.round(grant.amountCents / 100)) : "");
  const [restricted, setRestricted] = useState(grant?.restricted ?? true);
  const [schedule, setSchedule] = useState<(typeof REPORTING_SCHEDULES)[number]>(grant?.reportingSchedule ?? "quarterly");
  const [status, setStatus] = useState<GrantStatus>(grant?.status ?? "active");
  const [rows, setRows] = useState<Row[]>(() => (grant?.indicators ?? []).map((i, idx) => ({ key: `init${idx}`, metric: i.metric, target: i.target })));

  const errors = {
    funder: !funderId ? "Choose a funder." : "",
    title: title.trim().length < 2 ? "Give the grant a title." : "",
    start: !periodStart ? "Pick a start date." : "",
    end: !periodEnd ? "Pick an end date." : periodEnd <= periodStart ? "The end must be after the start." : "",
  };

  const usedMetrics = useMemo(() => new Set(rows.map((r) => r.metric)), [rows]);
  const addRow = () => {
    const next = INDICATOR_CATALOGUE.find((m) => !usedMetrics.has(m.metric)) ?? INDICATOR_CATALOGUE[0]!;
    setRows((r) => [...r, { key: `k${keySeq.current++}`, metric: next.metric, target: next.defaultTarget }]);
  };
  const patchRow = (key: string, next: Partial<Row>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...next } : row)));
  const removeRow = (key: string) => setRows((r) => r.filter((row) => row.key !== key));

  const submit = () => {
    setAttempted(true);
    if (errors.funder || errors.title || errors.start || errors.end) return;
    start(async () => {
      const payload = {
        funderId: funderId!,
        title: title.trim(),
        periodStart,
        periodEnd,
        amountRands: Math.max(0, Math.round(Number(amount) || 0)),
        restricted,
        reportingSchedule: schedule,
        status,
        indicators: rows.map((r) => ({ metric: r.metric, target: Math.max(0, Math.round(r.target || 0)) })),
      };
      const res = editing ? await updateGrant({ ...payload, grantId: grant!.id }) : await createGrant(payload);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: editing ? "Grant updated" : "Grant created", description: `${title.trim()} saved with ${rows.length} indicator${rows.length === 1 ? "" : "s"}.` });
      setOpen(false);
      setAttempted(false);
      router.refresh();
    });
  };

  const noFunders = funders.length === 0;

  return (
    <>
      {trigger === "edit" ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-4" strokeWidth={2} aria-hidden /> Edit grant
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={noFunders} title={noFunders ? "Add a funder first" : undefined}>
          <Plus className="size-4" strokeWidth={2} aria-hidden /> New grant
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${grant!.title}` : "New grant"}
        description="Set the grant's period, amount and targets. Actuals roll up live from the clinical work."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending}>{editing ? "Save grant" : "Create grant"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Funder</Label>
              <Select value={funderId} onChange={setFunderId} placeholder="Choose" options={funders.map((f) => ({ value: f.id, label: f.name }))} invalid={Boolean(attempted && errors.funder)} />
              {attempted && errors.funder ? <FieldError>{errors.funder}</FieldError> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onChange={(v) => setStatus(v as GrantStatus)} options={GRANT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Grant title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Community mental-health programme 2026" invalid={Boolean(attempted && errors.title)} />
            {attempted && errors.title ? <FieldError>{errors.title}</FieldError> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Period start</Label>
              <DatePicker value={periodStart} onChange={setPeriodStart} invalid={Boolean(attempted && errors.start)} ariaLabel="Period start" />
              {attempted && errors.start ? <FieldError>{errors.start}</FieldError> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Period end</Label>
              <DatePicker value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} invalid={Boolean(attempted && errors.end)} ariaLabel="Period end" />
              {attempted && errors.end ? <FieldError>{errors.end}</FieldError> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Grant amount</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-[13.5px] text-text-3">R</span>
                <Input type="number" min={0} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="850000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reporting</Label>
              <Select value={schedule} onChange={(v) => setSchedule(v as (typeof REPORTING_SCHEDULES)[number])} options={REPORTING_SCHEDULES.map((s) => ({ value: s, label: SCHEDULE_LABELS[s] }))} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRestricted((v) => !v)}
            className={cn("flex w-full items-start gap-2.5 rounded-control border p-3 text-left transition-colors", restricted ? "border-accent/40 bg-accent-soft/40" : "border-border bg-surface hover:bg-surface-hover")}
          >
            <span>
              <span className="block text-[13px] font-medium text-text">Restricted funding</span>
              <span className="block text-[11.5px] text-text-2">Ring-fenced for this programme (as opposed to unrestricted core funding).</span>
            </span>
            <span className={cn("ml-auto mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", restricted ? "bg-accent" : "bg-surface-2")}>
              <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", restricted && "translate-x-4")} />
            </span>
          </button>

          {/* Indicators */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Target className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Targets to track</Label>
              <button type="button" onClick={addRow} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                <Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add target
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-control border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-text-3">No targets yet  add one so this grant reports progress.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => {
                  const meta = indicatorMeta(row.metric)!;
                  return (
                    <div key={row.key} className="flex items-end gap-2 rounded-control border border-border bg-surface p-2.5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Select value={row.metric} onChange={(v) => patchRow(row.key, { metric: v as IndicatorMetric, target: indicatorMeta(v)?.defaultTarget ?? row.target })} options={INDICATOR_CATALOGUE.map((m) => ({ value: m.metric, label: m.label }))} />
                        <p className="truncate text-[11px] text-text-3">{meta.rule}</p>
                      </div>
                      <div className="w-24 space-y-1">
                        <span className="block text-[11px] text-text-3">Target ({meta.unit})</span>
                        <Input type="number" min={0} inputMode="numeric" value={row.target} onChange={(e) => patchRow(row.key, { target: Number(e.target.value) })} className="h-9" />
                      </div>
                      <button type="button" onClick={() => removeRow(row.key)} className="mb-1.5 text-text-3 hover:text-danger" aria-label="Remove target"><Trash2 className="size-4" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
