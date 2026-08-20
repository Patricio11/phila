"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, ExternalLink, Eye, FileText, FolderClosed, FolderOpen, Info, Link2, Pencil, Plus, Trash2, Upload, UserRound, Users } from "lucide-react";
import type { Document, DocumentFolder } from "@/lib/domain/types";
import { sizeLabel } from "@/lib/documents/quota";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { cn } from "@/lib/utils";
import { signCounsellorDownload, addSharedFolderLink, updateMyLink, deleteMyLink, requestCounsellorUpload, confirmCounsellorUpload } from "@/app/app/documents/actions";

type Named = { id: string; name: string };
type SharedFolder = { folder: DocumentFolder; docs: Document[]; mine?: boolean };
/** Batch 4k - what a supervisor sees of each supervisee. */
type Supervising = { counsellor: Named; folders: SharedFolder[]; clientDocs: Document[] };
/** Batch 4r - the counsellor's own folder subtree (client folders live inside). */
type Tree = { rootId: string | null; folders: DocumentFolder[]; docs: Document[] };

type Sel =
  | { t: "folder"; id: string }          // a folder in MY subtree (root, a client's, or any subfolder)
  | { t: "sharedFolder"; id: string }    // a folder the practice shared with me
  | { t: "sharedFiles" }                 // files shared directly with me
  | { t: "supervising"; id: string };    // one supervisee (read-only)

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/**
 * The counsellor's documents, batch 4r - laid out like the practice's own
 * Documents page: a folder tree on the left (your folder with every assigned
 * client's folder inside it, the folders the practice shared, files shared
 * with you, and anyone you supervise), a calm pane on the right with a
 * breadcrumb, folder cards and file rows. Same capabilities as before - open,
 * upload, download all, add / edit / remove your links - just one smooth flow.
 */
export function CounsellorDocuments({ own, shared, sharedNotes = {}, sharedFolders, clients, supervising = [], storageOn = true, tree = { rootId: null, folders: [], docs: [] } }: {
  own: Document[];
  shared: Document[];
  sharedNotes?: Record<string, string>;
  sharedFolders: SharedFolder[];
  clients: Named[];
  supervising?: Supervising[];
  storageOn?: boolean;
  tree?: Tree;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  /* ---- the tree model ---------------------------------------------------- */
  const folderById = useMemo(() => new Map(tree.folders.map((f) => [f.id, f])), [tree.folders]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, DocumentFolder[]>();
    for (const f of tree.folders) {
      if (!f.parentId || f.id === tree.rootId) continue;
      const arr = m.get(f.parentId);
      if (arr) arr.push(f); else m.set(f.parentId, [f]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [tree.folders, tree.rootId]);
  const inTreeDocIds = useMemo(() => new Set(tree.docs.map((d) => d.id)), [tree.docs]);
  // Own docs that live OUTSIDE my subtree (older files assigned to a client, no folder).
  const looseByClient = useMemo(() => {
    const m = new Map<string, Document[]>();
    for (const d of own) {
      if (inTreeDocIds.has(d.id)) continue;
      const k = d.clientId ?? "";
      const arr = m.get(k);
      if (arr) arr.push(d); else m.set(k, [d]);
    }
    return m;
  }, [own, inTreeDocIds]);
  const practiseShared = sharedFolders.filter((f) => !f.mine);
  const mineShared = sharedFolders.find((f) => f.mine); // pre-4r fallback when no tree (mock mode)
  const defaultSel: Sel = tree.rootId
    ? { t: "folder", id: tree.rootId }
    : mineShared ? { t: "sharedFolder", id: mineShared.folder.id }
    : practiseShared[0] ? { t: "sharedFolder", id: practiseShared[0].folder.id }
    : { t: "sharedFiles" };
  const [sel, setSel] = useState<Sel>(defaultSel);

  /* ---- uploads (unchanged mechanics) -------------------------------------- */
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ folderId?: string; clientId?: string; label: string } | null>(null);
  const [uploading, setUploading] = useState(0);
  const pickFiles = (target: { folderId?: string; clientId?: string; label: string }) => {
    if (!storageOn) return toast({ tone: "default", title: "Uploads aren't on yet", description: "Phila Storage is switched on by an admin under Admin → Integrations." });
    setUploadTarget(target);
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

  /* ---- links (unchanged mechanics) ---------------------------------------- */
  const [linkFor, setLinkFor] = useState<DocumentFolder | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [pending, start] = useTransition();

  async function openDoc(d: Document) {
    if (d.externalUrl) { window.open(d.externalUrl, "_blank", "noopener"); return; }
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

  /* ---- what the main pane shows ------------------------------------------- */
  const paneDocsFor = (folderId: string): Document[] => {
    const f = folderById.get(folderId);
    const docs = tree.docs.filter((d) => d.folderId === folderId);
    // A client's folder also gathers their older loose files (pre-4r uploads).
    if (f?.clientId) docs.push(...(looseByClient.get(f.clientId) ?? []));
    if (folderId === tree.rootId) docs.push(...(looseByClient.get("") ?? []));
    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };
  const crumbs = (folderId: string): DocumentFolder[] => {
    const out: DocumentFolder[] = [];
    let cur = folderById.get(folderId);
    while (cur) { out.unshift(cur); cur = cur.id === tree.rootId ? undefined : (cur.parentId ? folderById.get(cur.parentId) : undefined); }
    return out;
  };

  const empty = !tree.rootId && own.length === 0 && shared.length === 0 && sharedFolders.length === 0 && supervising.length === 0;
  if (empty) {
    return (
      <div className="space-y-3">
        <EmptyState icon={FileText} title="No documents yet" body="Your clients' files and anything the practice shares with you will appear here." />
        <input ref={fileInput} type="file" multiple className="hidden" aria-hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex justify-center"><Button onClick={() => pickFiles({ label: "your folder" })}><Upload className="size-4" strokeWidth={2.2} aria-hidden /> Upload a file</Button></div>
      </div>
    );
  }

  // The sidebar's own-subtree rows (root + nested folders).
  const renderOwnTree = (parentId: string, depth: number): React.ReactNode[] =>
    (childrenOf.get(parentId) ?? []).flatMap((f) => [
      <NavItem
        key={f.id}
        active={sel.t === "folder" && sel.id === f.id}
        depth={depth}
        icon={f.clientId ? UserRound : FolderClosed}
        label={f.name}
        badge={tree.docs.filter((d) => d.folderId === f.id).length + (f.clientId ? (looseByClient.get(f.clientId)?.length ?? 0) : 0)}
        onClick={() => setSel({ t: "folder", id: f.id })}
      />,
      ...renderOwnTree(f.id, depth + 1),
    ]);

  const selFolder = sel.t === "folder" ? folderById.get(sel.id) : undefined;
  const selShared = sel.t === "sharedFolder" ? sharedFolders.find((f) => f.folder.id === sel.id) : undefined;
  const selSupervising = sel.t === "supervising" ? supervising.find((s) => s.counsellor.id === sel.id) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* ---- the tree ---- */}
      <aside className="h-fit rounded-card border border-border bg-surface p-2 shadow-sm">
        <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-3">Folders</div>
        <nav className="space-y-0.5" data-testid="counsellor-doc-tree">
          {tree.rootId && (
            <>
              <NavItem active={sel.t === "folder" && sel.id === tree.rootId} icon={sel.t === "folder" && sel.id === tree.rootId ? FolderOpen : FolderClosed} label="Your folder" onClick={() => setSel({ t: "folder", id: tree.rootId! })} />
              {renderOwnTree(tree.rootId, 1)}
            </>
          )}
          {practiseShared.length > 0 && (
            <>
              <div className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-3">Shared with you</div>
              {practiseShared.map(({ folder, docs }) => (
                <NavItem key={folder.id} active={sel.t === "sharedFolder" && sel.id === folder.id} icon={FolderClosed} label={folder.name} badge={docs.length} onClick={() => setSel({ t: "sharedFolder", id: folder.id })} />
              ))}
            </>
          )}
          {shared.length > 0 && (
            <NavItem active={sel.t === "sharedFiles"} icon={FileText} label="Files shared with you" badge={shared.length} onClick={() => setSel({ t: "sharedFiles" })} />
          )}
          {supervising.length > 0 && (
            <>
              <div className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-3">Supervising</div>
              {supervising.map((sv) => (
                <NavItem key={sv.counsellor.id} active={sel.t === "supervising" && sel.id === sv.counsellor.id} icon={Eye} tone="violet" label={sv.counsellor.name} onClick={() => setSel({ t: "supervising", id: sv.counsellor.id })} />
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* ---- the pane ---- */}
      <section className="min-w-0 rounded-card border border-border bg-surface shadow-sm">
        {/* header: breadcrumb + actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {sel.t === "folder" && selFolder ? (
            <nav className="flex min-w-0 flex-1 items-center gap-1 text-[13px]" aria-label="Folder path">
              {crumbs(selFolder.id).map((f, i, arr) => (
                <span key={f.id} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-text-3" aria-hidden />}
                  <button type="button" onClick={() => setSel({ t: "folder", id: f.id })} className={cn("truncate", i === arr.length - 1 ? "font-semibold text-text" : "text-text-2 hover:text-text")}>
                    {f.id === tree.rootId ? "Your folder" : f.name}
                  </button>
                </span>
              ))}
            </nav>
          ) : (
            <h2 className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px] font-semibold text-text">
              {sel.t === "sharedFolder" && selShared && <><FolderClosed className="size-4 text-accent" aria-hidden /> {selShared.folder.name}{selShared.folder.submissionsPrivate && <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">Only you see your files</span>}</>}
              {sel.t === "sharedFiles" && <><FileText className="size-4 text-accent" aria-hidden /> Files shared with you</>}
              {sel.t === "supervising" && selSupervising && <><Eye className="size-4 text-violet-600 dark:text-violet-300" aria-hidden /> Supervising · {selSupervising.counsellor.name}<span className="rounded-chip bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">Supervisee</span></>}
            </h2>
          )}
          <div className="flex flex-wrap gap-2">
            {sel.t === "folder" && selFolder && (
              <>
                <Button variant="ghost" size="sm" onClick={() => downloadFolder(paneDocsFor(selFolder.id))}><Download className="size-3.5" strokeWidth={2} aria-hidden /> Download all</Button>
                <Button size="sm" loading={uploading > 0} onClick={() => pickFiles(selFolder.clientId ? { clientId: selFolder.clientId, label: `${selFolder.name}'s folder` } : { folderId: selFolder.id, label: selFolder.id === tree.rootId ? "your folder" : selFolder.name })}>
                  <Upload className="size-3.5" strokeWidth={2.2} aria-hidden /> Upload
                </Button>
              </>
            )}
            {sel.t === "sharedFolder" && selShared && (
              <>
                <Button variant="ghost" size="sm" onClick={() => downloadFolder(selShared.docs)}><Download className="size-3.5" strokeWidth={2} aria-hidden /> Download all</Button>
                <Button variant="ghost" size="sm" onClick={() => setLinkFor(selShared.folder)}><Plus className="size-3.5" strokeWidth={2.2} aria-hidden /> Add link</Button>
                <Button size="sm" loading={uploading > 0} onClick={() => pickFiles({ folderId: selShared.folder.id, label: selShared.folder.name })}><Upload className="size-3.5" strokeWidth={2.2} aria-hidden /> Upload</Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* the org's instruction note on a shared folder */}
          {sel.t === "sharedFolder" && selShared?.folder.note && (
            <div className="flex items-start gap-2.5 rounded-control border border-accent/20 bg-accent-soft/40 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-text-2">{selShared.folder.note}</p>
            </div>
          )}

          {/* my subtree: child folder cards, then files */}
          {sel.t === "folder" && selFolder && (
            <>
              {(childrenOf.get(selFolder.id) ?? []).length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {(childrenOf.get(selFolder.id) ?? []).map((f) => {
                    const count = tree.docs.filter((d) => d.folderId === f.id).length + (f.clientId ? (looseByClient.get(f.clientId)?.length ?? 0) : 0);
                    return (
                      <button key={f.id} type="button" onClick={() => setSel({ t: "folder", id: f.id })} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover" data-testid="client-folder-card">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                          {f.clientId ? <UserRound className="size-[18px]" strokeWidth={1.9} aria-hidden /> : <FolderClosed className="size-[18px]" strokeWidth={1.9} aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-text">{f.name}</span>
                          <span className="block text-[11.5px] text-text-3">{count} item{count === 1 ? "" : "s"}{f.clientId ? " · client folder" : ""}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {paneDocsFor(selFolder.id).length === 0 && (childrenOf.get(selFolder.id) ?? []).length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-text-3">
                  {selFolder.clientId ? `Nothing on file for ${selFolder.name.split(" ")[0]} yet - session notes file themselves here, and Upload adds anything else.` : "Nothing here yet - anything the practice sends you lands in this folder."}
                </p>
              ) : (
                <DocList docs={paneDocsFor(selFolder.id)} onOpen={openDoc} />
              )}
            </>
          )}

          {/* a folder the practice shared */}
          {sel.t === "sharedFolder" && selShared && (
            selShared.docs.length === 0
              ? <p className="py-6 text-center text-[12.5px] text-text-3">Nothing here yet{selShared.folder.submissionsPrivate ? " - your submissions will appear here, visible only to you and the practice." : "."}</p>
              : <DocList docs={selShared.docs} onOpen={openDoc} notes={sharedNotes} onEditLink={openEdit} onDeleteLink={removeLink} />
          )}

          {/* files shared directly */}
          {sel.t === "sharedFiles" && <DocList docs={shared} onOpen={openDoc} showClient clientName={clientName} notes={sharedNotes} />}

          {/* a supervisee (read-only) */}
          {sel.t === "supervising" && selSupervising && (
            <>
              <p className="text-[11.5px] text-text-3">You see everything here because you supervise {selSupervising.counsellor.name.split(" ")[0]}. Every open is audited.</p>
              {selSupervising.folders.length === 0 && selSupervising.clientDocs.length === 0 && <p className="text-[12.5px] text-text-3">Nothing on file for {selSupervising.counsellor.name.split(" ")[0]} yet.</p>}
              {selSupervising.folders.map(({ folder, docs }) => (
                <div key={folder.id}>
                  <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-text"><FolderClosed className="size-3.5 text-violet-600 dark:text-violet-300" aria-hidden /> {folder.name}</div>
                  {docs.length === 0 ? <p className="text-[12px] text-text-3">Empty.</p> : <DocList docs={docs} onOpen={openDoc} />}
                </div>
              ))}
              {selSupervising.clientDocs.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-text"><Users className="size-3.5 text-text-3" aria-hidden /> Their clients&apos; files</div>
                  <DocList docs={selSupervising.clientDocs} onOpen={openDoc} showClient clientName={clientName} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <input ref={fileInput} type="file" multiple className="hidden" aria-hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }} />

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
  notes?: Record<string, string>;
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

/** One row in the folder tree. */
function NavItem({ active, depth = 0, icon: Icon, label, badge, onClick, tone }: { active: boolean; depth?: number; icon: typeof FolderClosed; label: string; badge?: number; onClick: () => void; tone?: "accent" | "violet" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[12.5px] transition-colors", active ? "bg-accent-soft/60 font-medium text-text" : "text-text-2 hover:bg-surface-hover hover:text-text")}
      style={{ paddingLeft: `${10 + depth * 16}px` }}
    >
      <Icon className={cn("size-4 shrink-0", tone === "violet" ? "text-violet-600 dark:text-violet-300" : active ? "text-accent" : "text-text-3")} strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof badge === "number" && badge > 0 && <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10.5px] tabular-nums text-text-3">{badge}</span>}
    </button>
  );
}
