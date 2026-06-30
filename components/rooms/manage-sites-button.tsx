"use client";

import { useRef, useState } from "react";
import { Building2, Plus, Save, Trash2 } from "lucide-react";
import type { Province } from "@/lib/domain/enums";
import { PROVINCES } from "@/lib/domain/enums";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, FieldError } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { saveSites } from "@/app/hub/rooms/actions";

interface SiteRow {
  id: string;
  name: string;
  province: Province;
}

export function ManageSitesButton({ sites, roomCounts }: { sites: SiteRow[]; roomCounts: Record<string, number> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const counter = useRef(sites.length + 1);
  const [rows, setRows] = useState<SiteRow[]>(sites);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (id: string, next: Partial<SiteRow>) => setRows((list) => list.map((s) => (s.id === id ? { ...s, ...next } : s)));
  const add = () => setRows((list) => [...list, { id: `site_new_${counter.current++}`, name: "", province: "Gauteng" }]);
  const remove = (id: string) => setRows((list) => list.filter((s) => s.id !== id));

  const save = async () => {
    setError(null);
    setSaving(true);
    const res = await saveSites({ sites: rows.map((s) => ({ id: s.id, name: s.name, province: s.province })) });
    setSaving(false);
    if (res.ok) {
      toast({ tone: "success", title: "Sites saved", description: "Your rooms are organised by these." });
      setOpen(false);
    } else setError(res.error);
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Building2 className="size-4" strokeWidth={2} aria-hidden /> Manage sites
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Sites & branches"
        description="The locations your rooms belong to. A practice with more than one branch manages them here."
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={add}><Plus className="size-4" strokeWidth={2} aria-hidden /> Add site</Button>
            <Button onClick={save} loading={saving}><Save className="size-4" strokeWidth={2} aria-hidden /> Save</Button>
          </div>
        }
      >
        <div className="space-y-2.5">
          {rows.map((s) => {
            const count = roomCounts[s.id] ?? 0;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} placeholder="e.g. Soweto branch" className="h-10" />
                </div>
                <div className="w-40 shrink-0">
                  <Select value={s.province} onChange={(v) => patch(s.id, { province: v as Province })} options={PROVINCES.map((p) => ({ value: p, label: p }))} />
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={rows.length === 1 || count > 0}
                  title={count > 0 ? `${count} room${count === 1 ? "" : "s"} here  move them first` : "Remove site"}
                  className="text-text-3 hover:text-danger disabled:opacity-30"
                  aria-label="Remove site"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
          <FieldError>{error}</FieldError>
          <p className="text-[11.5px] text-text-3">A site with rooms can&apos;t be removed until its rooms move  that keeps the schedule honest.</p>
        </div>
      </Dialog>
    </>
  );
}
