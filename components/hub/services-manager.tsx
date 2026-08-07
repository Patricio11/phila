"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, Plus, Save, Trash2 } from "lucide-react";
import type { Service } from "@/lib/domain/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveServices } from "@/app/hub/services/actions";
import { cn } from "@/lib/utils";

const DURATIONS = [30, 45, 60, 90, 120];
/** The house palette (same family the rooms use) - the service's calendar colour. */
const COLOURS = ["#1C7D58", "#3C7FB0", "#9a6418", "#6b4f8a", "#C2554D", "#0E7C7B"];

export function ServicesManager({ initial }: { initial: Service[] }) {
  const { toast } = useToast();
  const counter = useRef(initial.length + 1);
  const [services, setServices] = useState<Service[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (id: string, next: Partial<Service>) =>
    setServices((list) => list.map((s) => (s.id === id ? { ...s, ...next } : s)));
  const remove = (id: string) => setServices((list) => list.filter((s) => s.id !== id));
  const add = () => {
    const id = `svc_new_${counter.current++}`;
    // A fresh service picks the first palette colour nobody is using yet.
    const used = new Set(services.map((s) => s.colour));
    setServices((list) => [...list, { id, orgId: initial[0]?.orgId ?? "", name: "", durationMin: 60, priceCents: 45000, colour: COLOURS.find((c) => !used.has(c)) ?? COLOURS[0] }]);
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await saveServices({ services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, colour: s.colour ?? null })) });
    setSaving(false);
    if (res.ok) toast({ tone: "success", title: "Services saved", description: "Your booking page and invoices use these." });
    else setError(res.error);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s, i) => (
        <Card key={s.id} className="p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <Input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} placeholder={`Service ${i + 1}  e.g. Individual counselling`} className="font-medium" />

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-[12px]">Duration</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={s.durationMin}
                      onChange={(e) => patch(s.id, { durationMin: Number(e.target.value || 0) })}
                      className="h-10 w-20 text-[13.5px]"
                    />
                    <span className="text-[12.5px] text-text-3">min</span>
                  </div>
                  <div className="flex gap-1 pt-0.5">
                    {DURATIONS.map((d) => (
                      <button key={d} type="button" onClick={() => patch(s.id, { durationMin: d })} className="rounded-chip border border-border px-1.5 py-0.5 text-[10.5px] text-text-3 hover:border-accent hover:text-accent">{d}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[12px]">Price</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] text-text-3">R</span>
                    <Input
                      type="number"
                      min={0}
                      value={s.priceCents === null ? "" : s.priceCents / 100}
                      onChange={(e) => patch(s.id, { priceCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })}
                      placeholder="Enquire"
                      className="h-10 w-28 text-[13.5px]"
                    />
                  </div>
                  <p className="text-[10.5px] text-text-3">{s.priceCents === null ? "Shown as “Enquire”" : "ZAR per session"}</p>
                </div>
              </div>

              {/* Calendar colour (batch 2f) - this service's identity on the calendar. */}
              <div className="space-y-1">
                <Label className="text-[12px]">Calendar colour</Label>
                <div className="flex items-center gap-1.5">
                  {COLOURS.map((c) => {
                    const on = (s.colour ?? null) === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => patch(s.id, { colour: c })}
                        aria-pressed={on}
                        aria-label={`Colour ${c}`}
                        className={cn("grid size-7 place-items-center rounded-full transition-transform", on ? "scale-110" : "hover:scale-105")}
                        style={{ backgroundColor: c, ...(on ? { outline: `2px solid ${c}`, outlineOffset: "2px" } : {}) }}
                      >
                        {on && <Check className="size-3.5 text-white" strokeWidth={2.6} aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button type="button" onClick={() => remove(s.id)} disabled={services.length === 1} className="mt-1 text-text-3 hover:text-danger disabled:opacity-30" aria-label="Remove service"><Trash2 className="size-4" /></button>
          </div>
        </Card>
      ))}
      </div>

      <Button variant="ghost" onClick={add} className="w-full border border-dashed border-border">
        <Plus className="size-4" strokeWidth={2} aria-hidden /> Add a service
      </Button>

      <FieldError>{error}</FieldError>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface-2/40 p-3">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
          <Clock className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />
          Choose which of these clients can book  and in-person or online  under <Link href="/hub/booking" className="font-medium text-accent hover:underline">Booking</Link>.
        </p>
        <Button onClick={save} loading={saving}>
          <Save className="size-4" strokeWidth={2} aria-hidden /> Save services
        </Button>
      </div>
    </div>
  );
}
