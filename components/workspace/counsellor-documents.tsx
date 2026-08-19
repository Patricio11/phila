"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Eye, FileText, FolderClosed, Info, Link2, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import type { Document, DocumentFolder } from "@/lib/domain/types";
import { sizeLabel } from "@/lib/documents/quota";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { signCounsellorDownload, addSharedFolderLink, updateMyLink, deleteMyLink, requestCounsellorUpload, confirmCounsellorUpload } from "@/app/app/documents/actions";

type Named = { id: string; name: string };
type SharedFolder = { folder: DocumentFolder; docs: Document[]; mine?: boolean };
/** Batch 4k - what a supervisor sees of each supervisee. */
type Supervising = { counsellor: Named; folders: SharedFolder[]; clientDocs: Document[] };

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
export function CounsellorDocuments({ own, shared, sharedNotes = {}, sharedFolders, clients, supervising = [], storageOn = true }: {
  own: Document[];
  shared: Document[];
  /** Batch 2r - the instruction that came with a directly shared file, by id. */
  sharedNotes?: Record<string, string>;
  sharedFolders: SharedFolder[];
  clients: Named[];
  /** Batch 4k - a supervisor's view of each supervisee: their folders + their clients' files (read-only). */
  supervising?: Supervising[];
  /** Batch 4k - Phila Storage is live (uploads possible). */
  storageOn?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  // Batch 4k - upload into a folder or onto a client (a hidden input per target).
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ folderId?: string; clientId?: string; label: string } | null>(null);
  const [uploading, setUploading] = useState(0);
  const pickFiles = (target: { folderId?: string; clientId?: string; label: string }) => {
    if (!storageOn) return toast({ tone: "default", title: "Uploads aren't on yet", description: "Phila Storage is switched on by an admin under Admin → Integrations." });
    setUploadTarget(target);
    // Defer so the target is set before the picker opens.
    setTimeout(() => fileInput.current?.click(), 0);
  };
  async function uploadFiles(files: FileList) {
    const t = uploadTarget;
    if (!t) return;
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    let okCount = 0;
    for (const f of list) {
      try {
        const type = f.type || "application/octet-stream";
        const req = await requestCounsellorUpload({ folderId: t.folderId ?? null, clientId: t.clientId ?? null, name: f.name, contentType: type, bytes: f.size });
        if (!req.ok) { toast({ tone: "error", title: `Couldn't upload ${f.name}`, description: req.error }); continue; }
        let putOk = false;
        try {
          const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: f });
          putOk = put.ok;
        } catch { putOk = false; }
        if (!putOk) { toast({ tone: "error", title: `Upload failed for ${f.name}`, description: "Couldn't reach Phila Storage - check your connection and try again." }); continue; }
        const done = await confirmCounsellorUpload({ documentId: req.documentId, bytes: f.size });
        if (!done.ok) { toast({ tone: "error", title: `${f.name} wasn't accepted`, description: done.error }); continue; }
        okCount += 1;
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
    if (okCount > 0) {
      toast({ tone: "success", title: okCount === 1 ? "File uploaded" : `${okCount} files uploaded`, description: `Into ${t.label}.` });
      router.refresh();
    }
  }
  const [linkFor, setLinkFor] = useState<DocumentFolder | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  // Batch 2k - edit my own link (three-dots menu).
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
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

  const saveEdit = () => start(async () => {
    if (!editDoc) return;
    const res = await updateMyLink({ documentId: editDoc.id, name: editName.trim(), url: editUrl.trim() });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Link updated" });
    setEditDoc(null);
    router.refresh();
  });

  const removeLink = (d: Document) => start(async () => {
    const res = await deleteMyLink({ documentId: d.id });
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "default", title: "Link removed", description: `${d.name} is no longer in the folder.` });
    router.refresh();
  });

  const openEdit = (d: Document) => { setEditDoc(d); setEditName(d.name); setEditUrl(d.externalUrl ?? ""); };

  // Group own documents by client.
  const byClient = new Map<string, Document[]>();
  for (const d of own) {
    const key = d.clientId ?? "";
    const arr = byClient.get(key);
    if (arr) arr.push(d);
    else byClient.set(key, [d]);
  }

  const empty = own.length === 0 && shared.length === 0 && sharedFolders.length === 0 && supervising.length === 0;

  return (
    <div className="space-y-6">
      {empty && (
        <div className="space-y-3">
          <EmptyState icon={FileText} title="No documents yet" body="Your clients' files and anything the practice shares with you will appear here." />
          <div className="flex justify-center"><Button onClick={() => pickFiles({ label: "your folder" })}><Upload className="size-4" strokeWidth={2.2} aria-hidden /> Upload a file</Button></div>
        </div>
      )}

      {/* Folders the practice shared - the org's note + this counsellor's view */}
      {sharedFolders.map(({ folder, docs, mine }) => (
        <section key={folder.id} className="rounded-card border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-text">
              <FolderClosed className="size-4 text-accent" aria-hidden /> {folder.name}
              {mine && <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">Your folder</span>}
              {folder.submissionsPrivate && <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">Only you see your files</span>}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => downloadFolder(docs)}>
                <Download className="size-3.5" strokeWidth={2} aria-hidden /> Download all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLinkFor(folder)}>
                <Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add link
              </Button>
              <Button size="sm" loading={uploading > 0 && uploadTarget?.folderId === folder.id} onClick={() => pickFiles({ folderId: folder.id, label: folder.name })}>
                <Upload className="size-3.5" strokeWidth={2.2} aria-hidden /> Upload
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
              <p className="py-3 text-center text-[12.5px] text-text-3">
                {mine
                  ? "Nothing here yet - anything the practice sends you lands in this folder."
                  : `Nothing here yet${folder.submissionsPrivate ? " - your submissions will appear here, visible only to you and the practice." : "."}`}
              </p>
            ) : (
              <DocList docs={docs} onOpen={openDoc} notes={sharedNotes} onEditLink={openEdit} onDeleteLink={removeLink} />
            )}
          </div>
        </section>
      ))}

      {/* By client */}
      {[...byClient.entries()].map(([clientId, docs]) => (
        <section key={clientId} className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-text">
              <Users className="size-3.5 text-text-3" aria-hidden /> {clientName.get(clientId) ?? "Client"}
            </h2>
            <Button variant="ghost" size="sm" loading={uploading > 0 && uploadTarget?.clientId === clientId} onClick={() => pickFiles({ clientId, label: `${clientName.get(clientId) ?? "the client"}'s record` })}>
              <Upload className="size-3.5" strokeWidth={2.2} aria-hidden /> Upload
            </Button>
          </div>
          <DocList docs={docs} onOpen={openDoc} />
        </section>
      ))}

      {/* Batch 4k - a supervisor sees everything each supervisee holds (read-only here) */}
      {supervising.map((sv) => (
        <section key={sv.counsellor.id} className="rounded-card border border-violet-200/70 bg-surface shadow-sm dark:border-violet-900/40" data-testid={`supervising-${sv.counsellor.id}`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <Eye className="size-4 text-violet-600 dark:text-violet-300" strokeWidth={2} aria-hidden />
            <h2 className="text-[13.5px] font-semibold text-text">Supervising · {sv.counsellor.name}</h2>
            <span className="rounded-chip bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">Supervisee</span>
            <span className="ml-auto text-[11.5px] text-text-3">You see everything here because you supervise {sv.counsellor.name.split(" ")[0]}. Every open is audited.</span>
          </div>
          <div className="space-y-4 p-4">
            {sv.folders.length === 0 && sv.clientDocs.length === 0 && <p className="text-[12.5px] text-text-3">Nothing on file for {sv.counsellor.name.split(" ")[0]} yet.</p>}
            {sv.folders.map(({ folder, docs }) => (
              <div key={folder.id}>
                <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-text"><FolderClosed className="size-3.5 text-violet-600 dark:text-violet-300" aria-hidden /> {folder.name}</div>
                {docs.length === 0 ? <p className="text-[12px] text-text-3">Empty.</p> : <DocList docs={docs} onOpen={openDoc} />}
              </div>
            ))}
            {sv.clientDocs.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-text"><Users className="size-3.5 text-text-3" aria-hidden /> Their clients&apos; files</div>
                <DocList docs={sv.clientDocs} onOpen={openDoc} showClient clientName={clientName} />
              </div>
            )}
          </div>
        </section>
      ))}

      <input ref={fileInput} type="file" multiple className="hidden" aria-hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }} />

      {/* Files shared directly */}
      {shared.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-0.5 text-[13px] font-semibold text-text">
            <FolderClosed className="size-3.5 text-accent" aria-hidden /> Shared with you
          </h2>
          <DocList docs={shared} onOpen={openDoc} showClient clientName={clientName} notes={sharedNotes} />
        </section>
      )}

      {/* Edit my own link */}
      <Dialog
        open={Boolean(editDoc)}
        onClose={() => setEditDoc(null)}
        title="Edit your link"
        description="Only you and the practice see this submission."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditDoc(null)} disabled={pending}>Cancel</Button>
            <Button onClick={saveEdit} loading={pending} disabled={editName.trim().length < 2 || !/^https?:\/\//i.test(editUrl.trim())}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Link</Label><Input inputMode="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} /></div>
        </div>
      </Dialog>

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
            <Input aria-label="Link name" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g. CPD form - completed (Aisha)" />
          </div>
          <div className="space-y-1.5">
            <Label>Link</Label>
            <Input aria-label="Link URL" inputMode="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://docs.google.com/..." />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function DocList({ docs, onOpen, showClient, clientName, notes, onEditLink, onDeleteLink }: {
  docs: Document[]; onOpen: (d: Document) => void; showClient?: boolean; clientName?: Map<string, string>;
  /** Batch 2r - the instruction the practice attached when sharing this file. */
  notes?: Record<string, string>;
  /** Present only where the counsellor's OWN links live (a shared folder). */
  onEditLink?: (d: Document) => void; onDeleteLink?: (d: Document) => void;
}) {
  return (
    <ul className="space-y-2">
      {docs.map((d) => {
        const isLink = Boolean(d.externalUrl);
        const openable = isLink || (d.scanStatus === "clean" && Boolean(d.storageKey));
        const note = notes?.[d.id];
        return (
          <li key={d.id} className="rounded-card border border-border bg-surface p-3">
          <div className="flex items-center gap-3">
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
            {isLink && onEditLink && d.sharedBy === "counsellor" && (
              <KebabMenu
                label={`Options for ${d.name}`}
                items={[
                  { label: "Open link", icon: ExternalLink, onClick: () => onOpen(d) },
                  { label: "Edit link", icon: Pencil, onClick: () => onEditLink(d) },
                  ...(onDeleteLink ? [{ label: "Remove", icon: Trash2, onClick: () => onDeleteLink(d), danger: true }] : []),
                ]}
              />
            )}
            </div>
            {note && (
              <div className="mt-2.5 flex items-start gap-2 rounded-control border border-accent/20 bg-accent-soft/40 px-3 py-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                <p className="text-[12px] leading-relaxed text-text-2">{note}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
