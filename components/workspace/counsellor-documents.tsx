"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, FolderClosed, Info, Link2, Plus, Users } from "lucide-react";
import type { Document, DocumentFolder } from "@/lib/domain/types";
import { sizeLabel } from "@/lib/documents/quota";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { signCounsellorDownload, addSharedFolderLink } from "@/app/app/documents/actions";

type Named = { id: string; name: string };
type SharedFolder = { folder: DocumentFolder; docs: Document[] };

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/**
 * The counsellor's documents (batch 2k): their clients' files, files shared
 * directly with them, and folders the practice shared - each with the org's
 * instruction note. In a submissions-private folder they see the org's material
 * plus ONLY their own links/files, never another counsellor's. They can add a
 * link (e.g. their completed Google Doc) straight into a shared folder.
 */
export function CounsellorDocuments({ own, shared, sharedFolders, clients }: {
  own: Document[];
  shared: Document[];
  sharedFolders: SharedFolder[];
  clients: Named[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const [linkFor, setLinkFor] = useState<DocumentFolder | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [pending, start] = useTransition();

  async function openDoc(d: Document) {
    if (d.externalUrl) {
      window.open(d.externalUrl, "_blank", "noopener");
      return;
    }
    const res = await signCounsellorDownload({ documentId: d.id });
    if (!res.ok) return toast({ tone: "error", title: "Can't open this", description: res.error });
    window.open(res.url, "_blank", "noopener");
  }

  async function downloadFolder(docs: Document[]) {
    const files = docs.filter((d) => d.storageKey && d.scanStatus === "clean");
    if (files.length === 0) return toast({ tone: "default", title: "Nothing to download", description: "This folder holds links only - open them instead." });
    for (const d of files) {
      const res = await signCounsellorDownload({ documentId: d.id });
      if (res.ok) window.open(res.url, "_blank", "noopener");
    }
    toast({ tone: "success", title: `Opened ${files.length} file${files.length === 1 ? "" : "s"}` });
  }

  const submitLink = () => start(async () => {
    if (!linkFor) return;
    const res = await addSharedFolderLink({ folderId: linkFor.id, name: linkName.trim(), url: linkUrl.trim() });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Link added", description: `Saved to ${linkFor.name}. The practice can see it; other counsellors can't.` });
    setLinkFor(null); setLinkName(""); setLinkUrl("");
    router.refresh();
  });

  // Group own documents by client.
  const byClient = new Map<string, Document[]>();
  for (const d of own) {
    const key = d.clientId ?? "";
    const arr = byClient.get(key);
    if (arr) arr.push(d);
    else byClient.set(key, [d]);
  }

  const empty = own.length === 0 && shared.length === 0 && sharedFolders.length === 0;

  return (
    <div className="space-y-6">
      {empty && <EmptyState icon={FileText} title="No documents yet" body="Your clients' files and anything the practice shares with you will appear here." />}

      {/* Folders the practice shared - the org's note + this counsellor's view */}
      {sharedFolders.map(({ folder, docs }) => (
        <section key={folder.id} className="rounded-card border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-text">
              <FolderClosed className="size-4 text-accent" aria-hidden /> {folder.name}
              {folder.submissionsPrivate && <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">Only you see your files</span>}
            </h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => downloadFolder(docs)}>
                <Download className="size-3.5" strokeWidth={2} aria-hidden /> Download all
              </Button>
              <Button size="sm" onClick={() => setLinkFor(folder)}>
                <Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add link
              </Button>
            </div>
          </div>
          {folder.note && (
            <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-control border border-accent/20 bg-accent-soft/40 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-text-2">{folder.note}</p>
            </div>
          )}
          <div className="p-4 pt-3">
            {docs.length === 0 ? (
              <p className="py-3 text-center text-[12.5px] text-text-3">Nothing here yet{folder.submissionsPrivate ? " - your submissions will appear here, visible only to you and the practice." : "."}</p>
            ) : (
              <DocList docs={docs} onOpen={openDoc} />
            )}
          </div>
        </section>
      ))}

      {/* By client */}
      {[...byClient.entries()].map(([clientId, docs]) => (
        <section key={clientId} className="space-y-2">
          <h2 className="flex items-center gap-2 px-0.5 text-[13px] font-semibold text-text">
            <Users className="size-3.5 text-text-3" aria-hidden /> {clientName.get(clientId) ?? "Client"}
          </h2>
          <DocList docs={docs} onOpen={openDoc} />
        </section>
      ))}

      {/* Files shared directly */}
      {shared.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-0.5 text-[13px] font-semibold text-text">
            <FolderClosed className="size-3.5 text-accent" aria-hidden /> Shared with you
          </h2>
          <DocList docs={shared} onOpen={openDoc} showClient clientName={clientName} />
        </section>
      )}

      {/* Add a link into a shared folder */}
      <Dialog
        open={Boolean(linkFor)}
        onClose={() => setLinkFor(null)}
        title={linkFor ? `Add a link to ${linkFor.name}` : "Add a link"}
        description="Paste the link to your completed document (e.g. your Google Doc). The practice sees it; other counsellors don't."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLinkFor(null)} disabled={pending}>Cancel</Button>
            <Button onClick={submitLink} loading={pending} disabled={linkName.trim().length < 2 || !/^https?:\/\//i.test(linkUrl.trim())}>Add link</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g. CPD form - completed (Aisha)" />
          </div>
          <div className="space-y-1.5">
            <Label>Link</Label>
            <Input inputMode="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://docs.google.com/..." />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function DocList({ docs, onOpen, showClient, clientName }: { docs: Document[]; onOpen: (d: Document) => void; showClient?: boolean; clientName?: Map<string, string> }) {
  return (
    <ul className="space-y-2">
      {docs.map((d) => {
        const isLink = Boolean(d.externalUrl);
        const openable = isLink || (d.scanStatus === "clean" && Boolean(d.storageKey));
        return (
          <li key={d.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-3">
              {isLink ? <Link2 className="size-[18px] text-accent" strokeWidth={1.9} aria-hidden /> : <FileText className="size-[18px]" strokeWidth={1.9} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-text">{d.name}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-3">
                <span>{isLink ? "link" : sizeLabel(d.bytes)}</span>
                <span>· {dateLabel(d.createdAt)}</span>
                {showClient && d.clientId && <span>· {clientName?.get(d.clientId) ?? "Client"}</span>}
                {!isLink && d.scanStatus === "pending" && <span className="text-warn">· scanning…</span>}
              </div>
            </div>
            {openable && (
              <button
                type="button"
                onClick={() => onOpen(d)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text"
                aria-label={`Open ${d.name}`}
              >
                {isLink ? <ExternalLink className="size-[18px]" strokeWidth={1.9} aria-hidden /> : <Download className="size-[18px]" strokeWidth={1.9} aria-hidden />}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
