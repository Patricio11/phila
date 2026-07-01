"use client";

import { Download, FileText, FolderClosed, Users } from "lucide-react";
import type { Document } from "@/lib/domain/types";
import { sizeLabel } from "@/lib/documents/quota";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { signCounsellorDownload } from "@/app/app/documents/actions";

type Named = { id: string; name: string };

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function CounsellorDocuments({ own, shared, clients }: { own: Document[]; shared: Document[]; clients: Named[] }) {
  const { toast } = useToast();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  async function download(documentId: string) {
    const res = await signCounsellorDownload({ documentId });
    if (!res.ok) return toast({ tone: "error", title: "Can't open this", description: res.error });
    window.open(res.url, "_blank", "noopener");
  }

  // Group own documents by client.
  const byClient = new Map<string, Document[]>();
  for (const d of own) {
    const key = d.clientId ?? "";
    const arr = byClient.get(key);
    if (arr) arr.push(d);
    else byClient.set(key, [d]);
  }

  const empty = own.length === 0 && shared.length === 0;

  return (
    <div className="space-y-6">
      {empty && <EmptyState icon={FileText} title="No documents yet" body="Your clients' files and anything the practice shares with you will appear here." />}

      {/* By client */}
      {[...byClient.entries()].map(([clientId, docs]) => (
        <section key={clientId} className="space-y-2">
          <h2 className="flex items-center gap-2 px-0.5 text-[13px] font-semibold text-text">
            <Users className="size-3.5 text-text-3" aria-hidden /> {clientName.get(clientId) ?? "Client"}
          </h2>
          <DocList docs={docs} onDownload={download} />
        </section>
      ))}

      {/* Shared with me */}
      {shared.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-0.5 text-[13px] font-semibold text-text">
            <FolderClosed className="size-3.5 text-accent" aria-hidden /> Shared with you
          </h2>
          <DocList docs={shared} onDownload={download} showClient clientName={clientName} />
        </section>
      )}
    </div>
  );
}

function DocList({ docs, onDownload, showClient, clientName }: { docs: Document[]; onDownload: (id: string) => void; showClient?: boolean; clientName?: Map<string, string> }) {
  return (
    <ul className="space-y-2">
      {docs.map((d) => {
        const openable = d.scanStatus === "clean" && Boolean(d.storageKey);
        return (
          <li key={d.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-3">
              <FileText className="size-[18px]" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-text">{d.name}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-3">
                <span>{sizeLabel(d.bytes)}</span>
                <span>· {dateLabel(d.createdAt)}</span>
                {showClient && d.clientId && <span>· {clientName?.get(d.clientId) ?? "Client"}</span>}
                {d.scanStatus === "pending" && <span className="text-warn">· scanning…</span>}
              </div>
            </div>
            {openable && (
              <button
                type="button"
                onClick={() => onDownload(d.id)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
                aria-label={`Open ${d.name}`}
              >
                <Download className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
