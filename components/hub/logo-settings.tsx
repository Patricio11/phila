"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2, Building2 } from "lucide-react";
import { requestLogoUpload, confirmLogoUpload, removeOrgLogo } from "@/app/hub/settings/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Org logo (W6.1) — a real image upload via the documents storage pipeline (counts
 * against org storage). Shown on the public micro-site + booking page and here.
 * PNG/JPG/WebP, ≤ 2 MB.
 */
export function LogoSettings({ initialUrl }: { initialUrl: string | null }) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, startBusy] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const req = await requestLogoUpload({ name: file.name, contentType: file.type, bytes: file.size });
      if (!req.ok) { toast({ tone: "error", title: "Couldn't upload", description: req.error }); return; }
      const put = await fetch(req.uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
      if (!put.ok) { toast({ tone: "error", title: "Upload failed", description: "The image didn't reach storage  please try again." }); return; }
      const done = await confirmLogoUpload({ key: req.key, bytes: file.size });
      if (!done.ok) { toast({ tone: "error", title: "Couldn't save", description: done.error }); return; }
      setUrl(done.url);
      toast({ tone: "success", title: "Logo updated", description: "It now shows on your public page and booking." });
    } finally {
      setUploading(false);
    }
  };

  const remove = () => startBusy(async () => {
    const res = await removeOrgLogo();
    if (!res.ok) return toast({ tone: "error", title: res.error });
    setUrl(null);
    toast({ tone: "default", title: "Logo removed", description: "Your wordmark shows instead." });
  });

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-text-2">Your logo appears on your public page and booking flow. PNG, JPG, or WebP  up to 2 MB. It counts towards your storage.</p>
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-surface-2/50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Organisation logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <Building2 className="size-6 text-text-3" strokeWidth={1.8} aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPick} aria-hidden />
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} loading={uploading}>
            <ImagePlus className="size-4" strokeWidth={2} aria-hidden /> {url ? "Replace logo" : "Upload logo"}
          </Button>
          {url && (
            <Button size="sm" variant="ghost" onClick={remove} loading={busy} className="text-danger hover:text-danger">
              <Trash2 className="size-4" strokeWidth={2} aria-hidden /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
