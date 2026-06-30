"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileText, Inbox, Upload } from "lucide-react";
import type { Document, DocumentRequest } from "@/lib/domain/types";
import { sizeLabel } from "@/lib/documents/quota";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { confirmClientUpload, requestClientUpload, signClientDownload } from "@/app/me/documents/actions";

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function ClientDocuments({
  documents,
  requests,
  storageEnabled,
}: {
  documents: Document[];
  requests: DocumentRequest[];
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function pick(requestId: string) {
    if (!storageEnabled) {
      toast({ tone: "default", title: "Uploads aren't on yet", description: "Your practice is still setting this up." });
      return;
    }
    activeRequest.current = requestId;
    fileInput.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const requestId = activeRequest.current;
    e.target.value = "";
    if (!file || !requestId) return;
    setBusy(requestId);
    try {
      const type = file.type || "application/octet-stream";
      const req = await requestClientUpload({ requestId, name: file.name, contentType: type, bytes: file.size });
      if (!req.ok) return toast({ tone: "error", title: "Couldn't upload", description: req.error });
      const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
      if (!put.ok) return toast({ tone: "error", title: "Upload failed", description: "Please try again." });
      const conf = await confirmClientUpload({ documentId: req.documentId, bytes: file.size });
      if (!conf.ok) return toast({ tone: "error", title: "Upload failed", description: conf.error });
      toast({ tone: "success", title: "Sent", description: "Your counsellor can see it now." });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function download(documentId: string) {
    const res = await signClientDownload({ documentId });
    if (!res.ok) return toast({ tone: "error", title: "Can't open this", description: res.error });
    window.open(res.url, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      <input ref={fileInput} type="file" className="hidden" onChange={onFile} aria-hidden />

      {/* Requested from you */}
      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-0.5 text-[13px] font-semibold text-text">Requested from you</h2>
          {requests.map((r) => (
            <div key={r.id} className="rounded-card border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-accent/15 text-accent">
                  <Inbox className="size-[18px]" strokeWidth={1.9} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-text">{r.title}</div>
                  {r.note && <p className="mt-0.5 text-[12.5px] leading-snug text-text-2">{r.note}</p>}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" loading={busy === r.id} onClick={() => pick(r.id)}>
                  <Upload className="size-4" aria-hidden /> Upload
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Shared with you / your uploads */}
      <section className="space-y-2">
        <h2 className="px-0.5 text-[13px] font-semibold text-text">Your documents</h2>
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" body="Reports and resources your counsellor shares will appear here." />
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-3">
                  <FileText className="size-[18px]" strokeWidth={1.9} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-text">{d.name}</div>
                  <div className="flex items-center gap-2 text-[11.5px] text-text-3">
                    {d.sharedBy === "client" ? <span className="inline-flex items-center gap-1 text-accent"><CheckCircle2 className="size-3" strokeWidth={2.4} aria-hidden /> You sent this</span> : <span>From your counsellor</span>}
                    <span>· {sizeLabel(d.bytes)}</span>
                    <span>· {dateLabel(d.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => download(d.id)}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
                  aria-label={`Open ${d.name}`}
                >
                  <Download className="size-[18px]" strokeWidth={1.9} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
