"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, Users } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setGrantClients } from "@/app/hub/funders/actions";
import { cn } from "@/lib/utils";

/**
 * Tag which clients count toward this grant's targets. A searchable multi-select;
 * the reporting engine only ever counts *consented* demographics on shared views,
 * but tagging is what scopes the cohort. Replaces the whole allocation on save.
 */
export function ManageGrantClients({ grantId, clients, initial }: { grantId: string; clients: { id: string; name: string }[]; initial: string[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set(initial));

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? clients.filter((c) => c.name.toLowerCase().includes(t)) : clients;
  }, [query, clients]);

  const toggle = (id: string) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const open_ = () => { setPicked(new Set(initial)); setQuery(""); setOpen(true); };

  const save = () => {
    start(async () => {
      const res = await setGrantClients({ grantId, clientIds: [...picked] });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Tagged clients updated", description: `${picked.size} client${picked.size === 1 ? "" : "s"} count toward this grant.` });
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={open_}>
        <Users className="size-4" strokeWidth={2} aria-hidden /> Tag clients
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Tag clients to this grant"
        description="These clients' work counts toward the grant's targets. Reporting stays de-identified."
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-text-3">{picked.size} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={save} loading={pending}>Save</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients…" className="pl-9" />
          </div>
          <div className="max-h-80 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-text-3">No clients found.</p>
            ) : (
              filtered.map((c) => {
                const on = picked.has(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)} className={cn("flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors", on ? "bg-accent-soft" : "hover:bg-surface-hover")}>
                    <Avatar name={c.name} size="sm" />
                    <span className={cn("min-w-0 flex-1 truncate text-[13.5px] font-medium", on ? "text-accent" : "text-text")}>{c.name}</span>
                    <span className={cn("inline-flex size-5 items-center justify-center rounded-md border", on ? "border-accent bg-accent text-accent-ink" : "border-border-strong")}>
                      {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                    </span>
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
