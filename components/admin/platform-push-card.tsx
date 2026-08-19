"use client";

import { useState, useTransition } from "react";
import { BellRing, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveWebPushConfig } from "@/app/admin/integrations/actions";
import { PushOptIn } from "@/components/push/push-opt-in";
import { cn } from "@/lib/utils";

/**
 * Batch 4m - Web push. No third party: Phila signs pushes with its own VAPID
 * key pair, generated here once (private half encrypted at rest). Switch on ->
 * every signed-in person can turn notifications on for their device from
 * Messages / their settings. Regenerating the keys silently invalidates every
 * existing subscription (they'll be offered the banner again).
 */
export function PlatformPushCard({ initial }: { initial: { enabled: boolean; configured: boolean; publicKey: string; subject: string } }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState(initial.subject);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [publicKey, setPublicKey] = useState(initial.publicKey);
  const configured = Boolean(publicKey);

  const save = (nextEnabled: boolean, regenerate = false) =>
    start(async () => {
      const res = await saveWebPushConfig({ subject, enabled: nextEnabled, regenerate });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setEnabled(nextEnabled);
      setPublicKey(res.publicKey);
      toast({ tone: "success", title: regenerate ? "New keys generated" : nextEnabled ? "Web push switched on" : "Saved", description: regenerate ? "Every device must turn notifications on again." : undefined });
    });

  return (
    <div className="space-y-3">
      <div className={cn("rounded-card border p-4", enabled ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")} data-testid="push-card">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
            <BellRing className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[14px] font-[660] text-text">
              Web push
              {enabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent"><CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> Live</span>
              ) : configured ? (
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Keys ready · off</span>
              ) : (
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-2">Dormant</span>
              )}
            </div>
            <div className="text-[11.5px] text-text-3">Browser and phone notifications for Phila messages. Pushed only to people who are away, one card per conversation, never the message itself. Phila&apos;s own keys - no vendor, no cost.</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Contact (VAPID subject)</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="mailto:hello@philasa.com" />
            <p className="text-[11px] text-text-3">Push services may use it to reach you about abuse. Defaults to mailto:hello@philasa.com.</p>
          </div>
          <div className="space-y-1">
            <Label>Public key</Label>
            <div className="flex items-center gap-2">
              <code className="block min-h-9 flex-1 truncate rounded-control border border-border bg-surface-2/60 px-2.5 py-2 font-mono text-[11px] text-text-2" title={publicKey}>{publicKey || "Generated when you save"}</code>
              {configured && (
                <Button variant="ghost" size="sm" onClick={() => save(enabled, true)} disabled={pending} title="Generate a new key pair">
                  <KeyRound className="size-3.5" strokeWidth={2} aria-hidden /> Regenerate
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1" />
          {enabled ? (
            <>
              <Button size="sm" onClick={() => save(true)} loading={pending}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => save(false)} disabled={pending}>Switch off</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => save(true)} loading={pending}>{configured ? "Switch on" : "Generate keys + switch on"}</Button>
          )}
        </div>
      </div>

      {enabled && (
        <div className="rounded-card border border-border bg-surface p-3">
          <div className="mb-2 text-[12px] font-[640] text-text">Try it on this device</div>
          <PushOptIn variant="row" />
        </div>
      )}
    </div>
  );
}
