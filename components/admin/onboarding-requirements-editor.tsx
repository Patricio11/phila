"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { OnboardingRequirement } from "@/lib/data-provider";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveOnboardingRequirements } from "@/app/admin/onboarding/actions";
import { cn } from "@/lib/utils";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-surface-2")}>
      <span className={cn("size-4 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
    </button>
  );
}

export function OnboardingRequirementsEditor({ initial }: { initial: OnboardingRequirement[] }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState({ label: "", description: "" });

  const toggleRequired = (id: string) => setItems((p) => p.map((r) => (r.id === id ? { ...r, required: !r.required } : r)));
  const remove = (id: string) => setItems((p) => p.filter((r) => r.id !== id));
  const add = () => {
    if (draft.label.trim().length < 2) return;
    const id = `req_${draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24)}`;
    setItems((p) => [...p, { id, label: draft.label.trim(), description: draft.description.trim(), required: true }]);
    setDraft({ label: "", description: "" });
  };

  const save = () => start(async () => {
    const res = await saveOnboardingRequirements({ requirements: items });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Onboarding requirements saved", description: "Every new practice will be asked for these." });
  });

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-control border border-border p-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-text">{r.label}</div>
              <div className="text-[12px] text-text-2">{r.description}</div>
            </div>
            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-1.5 text-[11.5px] text-text-3">
                <Toggle on={r.required} onClick={() => toggleRequired(r.id)} /> {r.required ? "Required" : "Optional"}
              </label>
              <button type="button" onClick={() => remove(r.id)} aria-label="Remove" className="text-text-3 transition-colors hover:text-danger"><Trash2 className="size-4" strokeWidth={2} aria-hidden /></button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-[12.5px] text-text-3">No requirements — practices won&apos;t be asked for any documents.</li>}
      </ul>

      <div className="rounded-control border border-dashed border-border p-3.5">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Add a requirement</div>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Document name</Label><Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="e.g. B-BBEE certificate" /></div>
          <div className="space-y-1.5"><Label>Short description</Label><Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="What you need and why" /></div>
        </div>
        <Button variant="ghost" size="sm" className="mt-2.5" onClick={add} disabled={draft.label.trim().length < 2}><Plus className="size-4" strokeWidth={2.2} aria-hidden /> Add requirement</Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={pending}>Save requirements</Button>
      </div>
    </div>
  );
}
