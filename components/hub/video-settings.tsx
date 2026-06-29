"use client";

import { useState, useTransition } from "react";
import { Video, ExternalLink } from "lucide-react";
import type { VideoSettings } from "@/db/queries/video";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveVideoMode } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

export function VideoSettingsCard({ initial }: { initial: VideoSettings }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState(initial.mode);
  const [url, setUrl] = useState(initial.externalUrl ?? "");

  const save = () => start(async () => {
    const res = await saveVideoMode({ mode, externalUrl: url });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Video settings saved" });
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Option
          active={mode === "livekit"} onClick={() => setMode("livekit")}
          icon={Video} title="Phila video" blurb="A secure, in-region room. Clients join from their link  no apps."
        />
        <Option
          active={mode === "external"} onClick={() => setMode("external")}
          icon={ExternalLink} title="Your own link" blurb="Use your Zoom / Meet / Teams link instead. We share it at booking time."
        />
      </div>

      {mode === "external" && (
        <div className="space-y-1">
          <Label htmlFor="ext-url">Your meeting link</Label>
          <Input id="ext-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-text-3">Phila video records nothing by default.</p>
        <Button onClick={save} loading={pending}>Save</Button>
      </div>
    </div>
  );
}

function Option({ active, onClick, icon: Icon, title, blurb }: { active: boolean; onClick: () => void; icon: typeof Video; title: string; blurb: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("flex flex-col items-start gap-1 rounded-control border p-3 text-left transition-colors", active ? "border-accent bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-hover")}>
      <Icon className={cn("size-4", active ? "text-accent" : "text-text-2")} strokeWidth={1.9} aria-hidden />
      <span className="text-[13px] font-[640] text-text">{title}</span>
      <span className="text-[11px] text-text-3">{blurb}</span>
    </button>
  );
}
