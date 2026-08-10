"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { requestMyPhotoUpload, confirmMyPhotoUpload, removeMyPhoto } from "@/lib/account/actions";

/**
 * Batch 2n - your profile picture. Presign, PUT the bytes straight to storage,
 * then confirm (which scans it and counts the bytes against the practice's
 * storage). Initials remain the honest fallback: no photo, no broken image.
 */
export function ProfilePhoto({ name, userId, hasPhoto, verified }: {
  name: string;
  userId: string;
  hasPhoto: boolean;
  verified?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  // Cache-buster so a replacement shows immediately instead of the old bytes.
  const [stamp, setStamp] = useState(0);
  const [photo, setPhoto] = useState(hasPhoto);
  const src = photo ? `/api/avatar/${userId}${stamp ? `?v=${stamp}` : ""}` : null;

  const pick = (file: File) => {
    setBusy(true);
    start(async () => {
      try {
        const signed = await requestMyPhotoUpload({ contentType: file.type, bytes: file.size });
        if (!signed.ok) { toast({ tone: "error", title: signed.error }); return; }
        const put = await fetch(signed.uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
        if (!put.ok) { toast({ tone: "error", title: "The upload didn't complete. Try again." }); return; }
        const done = await confirmMyPhotoUpload({ key: signed.key, bytes: signed.bytes });
        if (!done.ok) { toast({ tone: "error", title: done.error }); return; }
        setPhoto(true);
        setStamp(Date.now());
        toast({ tone: "success", title: "Photo updated", description: "Your picture now shows across the practice." });
        router.refresh();
      } catch {
        toast({ tone: "error", title: "That upload didn't go through", description: "Check your connection and try again." });
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  };

  const clear = () =>
    start(async () => {
      const res = await removeMyPhoto();
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setPhoto(false);
      toast({ tone: "success", title: "Photo removed", description: "You're back to your initials." });
      router.refresh();
    });

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <span className="relative">
        <Avatar name={name || "You"} size="lg" verified={verified} photoUrl={src} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || pending}
          aria-label={photo ? "Replace your profile photo" : "Upload a profile photo"}
          title={photo ? "Replace photo" : "Upload photo"}
          className="absolute -bottom-0.5 -right-0.5 inline-flex size-[22px] items-center justify-center rounded-full border border-border bg-surface text-text-2 shadow-sm transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          <Camera className="size-3" strokeWidth={2} aria-hidden />
        </button>
      </span>
      {photo && (
        <button type="button" onClick={clear} disabled={busy || pending} className="text-[11px] text-text-3 underline-offset-2 hover:text-text hover:underline disabled:opacity-60">
          Remove
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }}
      />
    </div>
  );
}
