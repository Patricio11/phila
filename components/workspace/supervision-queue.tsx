"use client";

import { useState } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import type { SupervisionItem } from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

function ago(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * The supervisor's sign-off queue. Provenance is honest  each item shows whose
 * note it is and when it was submitted. Signing off is the supervisor's explicit
 * action (mock here; Phase 14/B persists the sign-off + audit).
 */
export function SupervisionQueue({ items }: { items: SupervisionItem[] }) {
  const { toast } = useToast();
  const [queue, setQueue] = useState(items);

  const signOff = (item: SupervisionItem) => {
    setQueue((prev) => prev.filter((i) => i.id !== item.id));
    toast({ tone: "success", title: `Signed off ${item.superviseeName.split(" ")[0]}'s note`, description: `${item.clientName} · ${item.serviceName}` });
  };

  if (queue.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="Nothing to review" body="Notes your supervisees submit for sign-off will appear here." />;
  }

  return (
    <ul className="space-y-2">
      {queue.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
          <Avatar name={item.superviseeName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium text-text">
              {item.superviseeName} · <span className="text-text-2">{item.clientName}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-text-3">
              {item.serviceName} · submitted {ago(item.submittedAt)}
            </div>
          </div>
          <Button size="sm" onClick={() => signOff(item)}>
            <Check className="size-4" strokeWidth={2.4} aria-hidden /> Sign off
          </Button>
        </li>
      ))}
    </ul>
  );
}
