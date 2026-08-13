"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Upload } from "lucide-react";
import type { DocumentRequest } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { requestFulfilUpload, confirmFulfilUpload } from "@/app/app/documents/actions";

const DAY = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" }).format(new Date(iso));

/**
 * Batch 2z - what the practice has asked this counsellor for. Each request
 * carries its own Upload button; the file goes straight into their folder,
 * the request flips to fulfilled, and the practice's bell rings.
 */
export function CounsellorRequests({ requests }: { requests: DocumentRequest[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const pick = (requestId: string) => {
    setUploadingFor(requestId);
    fileRef.current?.click();
  };

  const upload = async (file: File) => {
    const requestId = uploadingFor;
    if (!requestId) return;
    setPendingId(requestId);
    try {
      const type = file.type || "application/octet-stream";
      const signed = await requestFulfilUpload({ requestId, name: file.name, contentType: type, bytes: file.size });
      if (!signed.ok) return toast({ tone: "error", title: "Couldn't upload", description: signed.error });
      const put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
      if (!put.ok) return toast({ tone: "error", title: "Upload failed", description: "Please try again." });
      const done = await confirmFulfilUpload({ documentId: signed.documentId, bytes: file.size });
      if (!done.ok) return toast({ tone: "error", title: "Couldn't finish the upload", description: done.error });
      toast({ tone: "success", title: "Uploaded", description: "It's in your folder, and the practice has been told." });
      router.refresh();
    } finally {
      setPendingId(null);
      setUploadingFor(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="rounded-card border border-warn/30 bg-warn-soft/30 shadow-sm">
      <div className="flex items-center gap-2 border-b border-warn/20 px-4 py-3">
        <Inbox className="size-4 text-warn" strokeWidth={2} aria-hidden />
        <h2 className="text-[13.5px] font-semibold text-text">
          Your practice needs {requests.length === 1 ? "a document" : `${requests.length} documents`} from you
        </h2>
      </div>
      <ul className="divide-y divide-warn/15 px-4">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-[600] text-text">{r.title}</div>
              <div className="mt-0.5 text-[11.5px] text-text-3">
                Requested {DAY(r.createdAt)}{r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
            <Button size="sm" onClick={() => pick(r.id)} loading={pendingId === r.id} disabled={Boolean(pendingId)}>
              <Upload className="size-3.5" strokeWidth={2} aria-hidden /> Upload
            </Button>
          </li>
        ))}
      </ul>
      <p className="px-4 pb-3 pt-1 text-[11px] text-text-3">Uploads land in your folder, visible to you and the practice.</p>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
    </section>
  );
}
