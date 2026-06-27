"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import type { GrantNarrative } from "@/lib/mock/types";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { postNarrative } from "@/app/hub/grants/[id]/actions";

function postedOn(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/** Post a narrative update the funder will see (Hub). Mock; Phase 16 persists. */
export function NarrativeComposer({ grantId, initial }: { grantId: string; initial: GrantNarrative[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  const post = () =>
    start(async () => {
      const res = await postNarrative({ grantId, body });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setItems((prev) => [{ ...res.narrative, grantId }, ...prev]);
      setBody("");
      toast({ tone: "success", title: "Update posted", description: "Your funder will see this on their portal." });
    });

  return (
    <div className="space-y-3">
      <div className="rounded-card border border-border bg-surface p-4">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share progress, context, or a story the funder should see…"
          className="min-h-[88px]"
          aria-label="Narrative update"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={post} loading={pending} disabled={!body.trim()}>
            <Send className="size-4" strokeWidth={2} aria-hidden /> Post update
          </Button>
        </div>
      </div>

      {items.map((n) => (
        <div key={n.id} className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-center justify-between text-[12px] text-text-3">
            <span className="font-medium text-text-2">{n.author}</span>
            <span>{postedOn(n.postedAt)}</span>
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">{n.body}</p>
        </div>
      ))}
    </div>
  );
}
