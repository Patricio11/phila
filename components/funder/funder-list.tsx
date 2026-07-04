"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, Trash2 } from "lucide-react";
import type { Funder } from "@/lib/domain/types";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FunderFormButton, FUNDER_TYPE_LABELS } from "@/components/funder/funder-form-modal";
import { deleteFunder } from "@/app/hub/funders/actions";

export function FunderList({ funders }: { funders: Funder[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<Funder | null>(null);

  const confirmRemove = () => {
    const f = removeTarget;
    if (!f) return;
    start(async () => {
      const res = await deleteFunder({ funderId: f.id });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "default", title: `${f.name} removed`, description: "The funder and its grants were removed." });
      setRemoveTarget(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {funders.map((f) => (
          <Card key={f.id} className="flex items-start gap-3 p-4">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-chip bg-surface-2 text-text-3">
              <Building2 className="size-[18px]" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-[620] text-text">{f.name}</div>
              <div className="text-[12px] text-text-3">{FUNDER_TYPE_LABELS[f.type]}</div>
              {f.contactEmail ? (
                <div className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-text-2"><Mail className="size-3 text-text-3" strokeWidth={2} aria-hidden /> {f.contactEmail}</div>
              ) : null}
              <div className="mt-2 flex items-center gap-1">
                <FunderFormButton funder={{ id: f.id, name: f.name, type: f.type, contactName: f.contactName, contactEmail: f.contactEmail }} />
                <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(f)}>
                  <Trash2 className="size-4" strokeWidth={2} aria-hidden /> Remove
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Remove ${removeTarget.name}?` : "Remove funder"}
        description="This removes the funder and any grants under it. Client records and sessions are untouched."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={pending}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove} loading={pending}>Remove funder</Button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-text-2">Grant targets and tags are removed with it  but nothing clinical (clients, sessions, outcomes) is affected.</p>
      </Dialog>
    </>
  );
}
