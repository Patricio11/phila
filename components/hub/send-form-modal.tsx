"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { sendForm } from "@/app/hub/forms/actions";
import { cn } from "@/lib/utils";

export type SendClient = { id: string; name: string; counsellorName: string };

export function SendFormModal({
  open,
  onClose,
  formId,
  formTitle,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  clients: SendClient[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? clients.filter((c) => `${c.name} ${c.counsellorName}`.toLowerCase().includes(t)) : clients;
  }, [q, clients]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) filtered.forEach((c) => n.delete(c.id));
      else filtered.forEach((c) => n.add(c.id));
      return n;
    });

  const close = () => { setSelected(new Set()); setQ(""); onClose(); };

  const send = () =>
    start(async () => {
      const res = await sendForm({ formId, clientIds: [...selected] });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: `Form sent to ${res.sent} ${res.sent === 1 ? "client" : "clients"}`, description: "Each gets a private link by WhatsApp or email once messaging is set up." });
      close();
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Send “${formTitle}”`}
      description="Choose who should fill this in. Each person gets their own private link."
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-text-3">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
            <Button onClick={send} loading={pending} disabled={selected.size === 0}>
              <Send className="size-4" strokeWidth={2} aria-hidden /> Send{selected.size > 0 ? ` to ${selected.size}` : ""}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="pl-9" />
        </div>

        {clients.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-3">No clients yet  add a client first.</p>
        ) : (
          <>
            <button type="button" onClick={toggleAll} className="text-[12px] font-medium text-accent hover:underline">
              {allVisibleSelected ? "Clear selection" : `Select all${q ? " shown" : ""} (${filtered.length})`}
            </button>
            <div className="max-h-[46vh] space-y-1 overflow-y-auto">
              {filtered.map((c) => {
                const on = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn("flex w-full items-center gap-3 rounded-control border px-3 py-2 text-left transition-colors", on ? "border-accent/50 bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover")}
                  >
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-text">{c.name}</div>
                      <div className="truncate text-[11.5px] text-text-3">{c.counsellorName}</div>
                    </div>
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", on ? "border-accent bg-accent text-white" : "border-border-strong")}>
                      {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="py-6 text-center text-[13px] text-text-3">No clients match “{q}”.</p>}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
