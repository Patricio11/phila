"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Plus, Trash2, Users, Zap } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createFormAutomation, deleteFormAutomation, shareFormWithCounsellors } from "@/app/hub/forms/actions";
import { cn } from "@/lib/utils";

export interface AutomationRow {
  id: string; formId: string; trigger: "on_booking" | "after_attended";
  threshold: number | null; firstBookingOnly: boolean; active: boolean;
}

/**
 * Batch 2l - "send this form when X happens", and who on the team may send it.
 * Two calm cards on the form page: Automations and Share with counsellors.
 */
/** 1st, 2nd, 3rd, 4th... - small thing, but "2th" reads like a bug. */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function FormAutomations({ formId, automations, counsellors, sharedWithAll, sharedWith }: {
  formId: string;
  automations: AutomationRow[];
  counsellors: { id: string; name: string }[];
  sharedWithAll: boolean;
  sharedWith: string[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [trigger, setTrigger] = useState<"on_booking" | "after_attended">("on_booking");
  const [threshold, setThreshold] = useState("5");
  const [firstOnly, setFirstOnly] = useState(true);
  const [all, setAll] = useState(sharedWithAll);
  const [picked, setPicked] = useState<Set<string>>(new Set(sharedWith));

  const add = () => start(async () => {
    const res = await createFormAutomation({
      formId, trigger,
      threshold: trigger === "after_attended" ? Math.max(1, Number(threshold) || 1) : null,
      firstBookingOnly: trigger === "on_booking" ? firstOnly : false,
    });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Automation added", description: trigger === "on_booking" ? "It sends when a booking is made." : `It sends after session ${threshold}.` });
    router.refresh();
  });

  const remove = (id: string) => start(async () => {
    const res = await deleteFormAutomation({ id, formId });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "default", title: "Automation removed" });
    router.refresh();
  });

  const saveSharing = (nextAll: boolean, nextPicked: Set<string>) => start(async () => {
    const res = await shareFormWithCounsellors({ formId, all: nextAll, counsellorIds: [...nextPicked] });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Sharing updated", description: nextAll ? "Every counsellor can send this form." : `${nextPicked.size} counsellor${nextPicked.size === 1 ? "" : "s"} can send this form.` });
    router.refresh();
  });

  const label = (a: AutomationRow) =>
    a.trigger === "on_booking"
      ? `When a booking is made${a.firstBookingOnly ? " (first booking only)" : ""}`
      : `After session ${a.threshold ?? 1} is attended`;

  return (
    <>
      <Card>
        <CardHead title={<span className="flex items-center gap-2"><Zap className="size-4 text-accent" strokeWidth={2} aria-hidden /> Send automatically</span>} count={automations.length} />
        <div className="space-y-3 px-[17px] pb-[17px]">
          <p className="text-[12.5px] leading-relaxed text-text-2">
            The practice never has to remember: pick a moment and this form goes out on its own. Each client gets it once.
          </p>

          {automations.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 rounded-control border border-border p-3">
              <CalendarCheck className="size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1 text-[13px] text-text">{label(a)}</span>
              <button type="button" onClick={() => remove(a.id)} disabled={pending} aria-label="Remove automation" className="shrink-0 rounded p-1 text-text-3 transition-colors hover:bg-surface-hover hover:text-danger">
                <Trash2 className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ))}

          <div className="space-y-3 rounded-control border border-dashed border-border p-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">When should it send?</Label>
              <Select
                value={trigger}
                onChange={(v) => setTrigger(v as "on_booking" | "after_attended")}
                options={[
                  { value: "on_booking", label: "When a booking is made" },
                  { value: "after_attended", label: "After N sessions attended" },
                ]}
              />
            </div>
            {trigger === "after_attended" ? (
              <div className="flex items-end gap-2">
                <div className="w-24 space-y-1.5">
                  <Label className="text-[12px]">Session</Label>
                  <Input inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
                </div>
                <p className="pb-2 text-[12px] text-text-3">Sends the moment their {threshold ? ordinal(Number(threshold)) : "Nth"} session is marked held.</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setFirstOnly((v) => !v)}
                className={cn("flex w-full items-start gap-2.5 rounded-control border p-2.5 text-left", firstOnly ? "border-accent bg-accent-soft/40" : "border-border")}
              >
                <span className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border", firstOnly ? "border-accent bg-accent" : "border-border")} />
                <span className="text-[12.5px] text-text-2">Only on their <strong className="text-text">first</strong> booking (the usual choice for an intake form).</span>
              </button>
            )}
            <Button size="sm" onClick={add} loading={pending} className="w-full">
              <Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add automation
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title={<span className="flex items-center gap-2"><Users className="size-4 text-accent" strokeWidth={2} aria-hidden /> Counsellors may send this</span>} />
        <div className="space-y-2 px-[17px] pb-[17px]">
          <p className="text-[12.5px] leading-relaxed text-text-2">
            Shared forms appear in a counsellor&apos;s Forms page, ready to send to their own clients.
          </p>
          <button
            type="button"
            onClick={() => { const next = !all; setAll(next); saveSharing(next, picked); }}
            className={cn("flex w-full items-center justify-between rounded-control border p-3 text-left transition-colors", all ? "border-accent bg-accent-soft/40" : "border-border hover:bg-surface-hover")}
          >
            <span className="text-[13px] font-medium text-text">Every counsellor</span>
            <span className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", all ? "bg-accent" : "bg-border-strong")}>
              <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", all && "translate-x-4")} />
            </span>
          </button>
          {!all && (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {counsellors.map((c) => {
                const on = picked.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(picked);
                        if (on) next.delete(c.id); else next.add(c.id);
                        setPicked(next);
                        saveSharing(false, next);
                      }}
                      className={cn("flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-[13px] transition-colors", on ? "bg-accent-soft text-text" : "text-text-2 hover:bg-surface-hover")}
                    >
                      {c.name}
                      <span className={cn("inline-flex size-4 items-center justify-center rounded-[5px] border", on ? "border-accent bg-accent" : "border-border")} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}
