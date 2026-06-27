"use client";

import { useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import type { ClientDocument } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";

const KIND_LABEL: Record<ClientDocument["kind"], string> = {
  report: "Report",
  resource: "Resource",
  upload: "Your upload",
  form: "Form",
};

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function DocumentList({ documents }: { documents: ClientDocument[] }) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(documents);

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mock: show it optimistically. Phase 10 stores to Supabase with a signed URL.
    setItems((prev) => [
      {
        id: `local_${prev.length}`,
        clientId: "self",
        orgId: "self",
        name: file.name,
        kind: "upload",
        sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        sharedBy: "client",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    toast({ tone: "success", title: "Document added", description: "Your counsellor will be able to see it." });
    e.target.value = "";
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <input ref={fileInput} type="file" className="hidden" onChange={onUpload} aria-hidden />
        <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" strokeWidth={2} aria-hidden /> Upload a document
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" body="Reports and resources your counsellor shares will appear here." />
      ) : (
        <ul className="space-y-2">
          {items.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-control bg-surface-2 text-text-3">
                <FileText className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-text">{doc.name}</div>
                <div className="text-[11.5px] text-text-3">
                  {KIND_LABEL[doc.kind]} · {doc.sizeLabel} · {dateLabel(doc.createdAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toast({ tone: "default", title: "Preparing your download", description: "A secure link opens here." })}
                className="inline-flex size-9 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
                aria-label={`Download ${doc.name}`}
              >
                <Download className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
