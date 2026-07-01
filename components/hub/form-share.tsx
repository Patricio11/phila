"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { setFormShare } from "@/app/hub/forms/actions";
import { cn } from "@/lib/utils";

/** The open share link  anyone with it can fill the form (great for lead capture). */
export function FormShare({ formId, shareToken, shareEnabled }: { formId: string; shareToken?: string | null; shareEnabled?: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(Boolean(shareEnabled));
  const [token, setToken] = useState<string | null>(shareToken ?? null);
  const [copied, setCopied] = useState(false);

  const url = token ? `${typeof window !== "undefined" ? window.location.origin : "https://philasa.com"}/f/${token}` : "";

  const toggle = () =>
    start(async () => {
      const res = await setFormShare(formId, !enabled);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setEnabled(res.shareEnabled);
      setToken(res.shareToken);
      toast({ tone: "success", title: res.shareEnabled ? "Share link on" : "Share link off" });
    });

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast({ tone: "error", title: "Couldn't copy  select and copy the link." }); }
  };

  return (
    <div className={cn("rounded-card border p-3.5", enabled ? "border-accent/40 bg-accent-soft/20" : "border-border bg-surface")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control", enabled ? "bg-accent text-white" : "bg-surface-2 text-text-3")}><Link2 className="size-4" strokeWidth={2} aria-hidden /></span>
          <div>
            <div className="text-[13px] font-[640] text-text">Open share link</div>
            <p className="text-[11.5px] leading-relaxed text-text-3">One public link anyone can fill  post it, or send it out. Each submission lands in Responses.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Open share link"
          onClick={toggle}
          disabled={pending}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60", enabled ? "bg-accent" : "bg-surface-2")}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-[22px]" : "translate-x-0.5")} />
        </button>
      </div>

      {enabled && token && (
        <div className="mt-3 flex items-center gap-2">
          <Input readOnly value={url} className="h-9 text-[12.5px]" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="ghost" size="sm" onClick={copy}>{copied ? <Check className="size-3.5 text-accent" strokeWidth={2.4} aria-hidden /> : <Copy className="size-3.5" strokeWidth={2} aria-hidden />} {copied ? "Copied" : "Copy"}</Button>
          <Button asChild variant="ghost" size="sm"><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" strokeWidth={2} aria-hidden /></a></Button>
        </div>
      )}
    </div>
  );
}
