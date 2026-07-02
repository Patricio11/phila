"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, Check, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reassignClient } from "@/app/hub/clients/actions";
import { cn } from "@/lib/utils";

export function ReassignClientButton({
  clientId,
  clientName,
  counsellors,
  currentCounsellorId,
}: {
  clientId: string;
  clientName: string;
  counsellors: { id: string; name: string }[];
  currentCounsellorId: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [counsellorId, setCounsellorId] = useState<string | null>(currentCounsellorId ?? counsellors[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? counsellors.filter((c) => c.name.toLowerCase().includes(t)) : counsellors;
  }, [query, counsellors]);

  const close = () => { setOpen(false); setQuery(""); };

  const submit = () => {
    if (!counsellorId) return;
    start(async () => {
      const res = await reassignClient({ clientId, counsellorId });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const name = counsellors.find((c) => c.id === counsellorId)?.name ?? "";
      setDone(name);
      toast({ tone: "success", title: `${clientName.split(" ")[0]} reassigned`, description: `Now with ${name.split(" ")[0]}. Full history moves with them.` });
      close();
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="size-4" strokeWidth={2} aria-hidden /> {done ? `With ${done.split(" ")[0]}` : "Reassign"}
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={`Reassign ${clientName}`}
        description="Move this client to another counsellor. Their history and outcomes move with them."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending} disabled={!counsellorId}>Reassign</Button>
          </div>
        }
      >
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search counsellors…" className="pl-9" />
          </div>

          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-text-3">No counsellors found.</p>
            ) : (
              filtered.map((c) => {
                const selected = c.id === counsellorId;
                const isCurrent = c.id === currentCounsellorId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCounsellorId(c.id)}
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
