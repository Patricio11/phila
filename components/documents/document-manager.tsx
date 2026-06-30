"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Download,
  FileText,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Inbox,
  MoveRight,
  Pencil,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Document, DocumentFolder, DocumentRequest, StorageUsage } from "@/lib/domain/types";
import { sizeLabel } from "@/lib/documents/quota";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  assignToClient,
  confirmUpload,
  createFolder,
  deleteItems,
  moveItems,
  renameFolder,
  requestDocument,
  requestUpload,
  shareWithCounsellors,
  signDownload,
} from "@/app/hub/documents/actions";

type Named = { id: string; name: string };
type View = "folders" | "review" | "byClient";

const fk = (id: string) => `f:${id}`;
const dk = (id: string) => `d:${id}`;

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function DocumentManager({
  folders: initialFolders,
  documents: initialDocs,
  clients,
  counsellors,
  requests,
  usage,
  storageEnabled,
}: {
  folders: DocumentFolder[];
  documents: Document[];
  clients: Named[];
  counsellors: Named[];
  requests: DocumentRequest[];
  usage: StorageUsage;
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  // Optimistic local state, re-synced from the server whenever a refresh delivers
  // new props (the React "adjust state during render" pattern — not an effect).
  const [folders, setFolders] = useState(initialFolders);
  const [docs, setDocs] = useState(initialDocs);
  const [seen, setSeen] = useState({ f: initialFolders, d: initialDocs });
  if (seen.f !== initialFolders || seen.d !== initialDocs) {
    setSeen({ f: initialFolders, d: initialDocs });
    setFolders(initialFolders);
    setDocs(initialDocs);
  }

  const [view, setView] = useState<View>("folders");
  const [cwd, setCwd] = useState<string | null>(null); // current folder; null = root
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const dragKeys = useRef<Set<string>>(new Set());

  // Dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignClient, setAssignClient] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareWith, setShareWith] = useState<Set<string>>(new Set());
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqClient, setReqClient] = useState<string | null>(null);
  const [reqTitle, setReqTitle] = useState("");
  const [reqNote, setReqNote] = useState("");

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const childFolders = (parentId: string | null) =>
    folders.filter((f) => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
  const docsIn = (folderId: string | null) =>
    docs.filter((d) => (d.folderId ?? null) === folderId).sort((a, b) => a.name.localeCompare(b.name));

  const breadcrumb = useMemo(() => {
    const path: DocumentFolder[] = [];
    let id = cwd;
    const byId = new Map(folders.map((f) => [f.id, f]));
    while (id) {
      const f = byId.get(id);
      if (!f) break;
      path.unshift(f);
      id = f.parentId;
    }
    return path;
  }, [cwd, folders]);

  const selectedDocIds = () => [...selected].filter((k) => k.startsWith("d:")).map((k) => k.slice(2));
  const selectedFolderIds = () => [...selected].filter((k) => k.startsWith("f:")).map((k) => k.slice(2));
  const clearSel = () => setSelected(new Set());

  function toggle(key: string, additive: boolean) {
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      if (additive && prev.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /* ── Move (the heart of the smooth feel) ─────────────────────────────── */
  async function doMove(items: { documentIds: string[]; folderIds: string[] }, target: string | null, targetLabel: string) {
    if (!items.documentIds.length && !items.folderIds.length) return;
    if (target && items.folderIds.includes(target)) {
      toast({ tone: "error", title: "Can't move a folder into itself" });
      return;
    }
    // Optimistic.
    setFolders((fs) => fs.map((f) => (items.folderIds.includes(f.id) ? { ...f, parentId: target } : f)));
    setDocs((ds) => ds.map((d) => (items.documentIds.includes(d.id) ? { ...d, folderId: target } : d)));
    clearSel();
    const res = await moveItems({ items, targetFolderId: target });
    if (!res.ok) {
      toast({ tone: "error", title: "Move failed", description: res.error });
      router.refresh();
    } else {
      const n = items.documentIds.length + items.folderIds.length;
      toast({ tone: "success", title: `Moved ${n} item${n > 1 ? "s" : ""}`, description: `to ${targetLabel}` });
      router.refresh();
    }
  }

  /* ── Drag and drop ───────────────────────────────────────────────────── */
  function onDragStart(e: React.DragEvent, key: string) {
    // Drag the current selection if the item is part of it; otherwise just this item.
    const keys = selected.has(key) ? new Set(selected) : new Set([key]);
    dragKeys.current = keys;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", [...keys].join(","));
  }
  function onDropFolder(target: string | null) {
    const keys = dragKeys.current;
    const items = {
      documentIds: [...keys].filter((k) => k.startsWith("d:")).map((k) => k.slice(2)),
      folderIds: [...keys].filter((k) => k.startsWith("f:")).map((k) => k.slice(2)),
    };
    const label = target ? folders.find((f) => f.id === target)?.name ?? "folder" : "Home";
    setDropTarget(null);
    dragKeys.current = new Set();
    void doMove(items, target, label);
  }

  /* ── Folder / file ops ───────────────────────────────────────────────── */
  async function onCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setNewFolderOpen(false);
    setNewFolderName("");
    const tempId = `tmp_${name}`;
    setFolders((fs) => [...fs, { id: tempId, orgId: "", parentId: cwd, name, scope: "org", clientId: null, createdAt: new Date().toISOString() }]);
    const res = await createFolder({ name, parentId: cwd });
    if (!res.ok) toast({ tone: "error", title: "Couldn't create folder", description: res.error });
    else toast({ tone: "success", title: "Folder created", description: name });
    router.refresh();
  }

  async function commitRename() {
    if (!renaming) return;
    const { id, value } = renaming;
    const name = value.trim();
    setRenaming(null);
    if (!name) return;
    setFolders((fs) => fs.map((f) => (f.id === id ? { ...f, name } : f)));
    const res = await renameFolder({ folderId: id, name });
    if (!res.ok) toast({ tone: "error", title: "Rename failed", description: res.error });
    router.refresh();
  }

  async function onAssign() {
    const documentIds = selectedDocIds();
    if (!assignClient || !documentIds.length) return;
    setAssignOpen(false);
    const res = await assignToClient({ documentIds, clientId: assignClient });
    if (!res.ok) toast({ tone: "error", title: "Assign failed", description: res.error });
    else toast({ tone: "success", title: `Assigned to ${clientName.get(assignClient) ?? "client"}` });
    setAssignClient(null);
    clearSel();
    router.refresh();
  }

  async function onShare() {
    const ids = [...shareWith];
    const docIds = selectedDocIds();
    const folderIds = selectedFolderIds();
    if (!ids.length) return;
    setShareOpen(false);
    // Share each selected item (file or folder) with each chosen counsellor.
    for (const id of docIds) await shareWithCounsellors({ targetType: "file", targetId: id, counsellorUserIds: ids });
    for (const id of folderIds) await shareWithCounsellors({ targetType: "folder", targetId: id, counsellorUserIds: ids });
    toast({ tone: "success", title: "Shared", description: `with ${ids.length} counsellor${ids.length > 1 ? "s" : ""}` });
    setShareWith(new Set());
    clearSel();
    router.refresh();
  }

  async function onDelete() {
    const documentIds = selectedDocIds();
    const folderIds = selectedFolderIds();
    const n = documentIds.length + folderIds.length;
    if (!n) return;
    setDocs((ds) => ds.filter((d) => !documentIds.includes(d.id)));
    setFolders((fs) => fs.filter((f) => !folderIds.includes(f.id)));
    clearSel();
    const res = await deleteItems({ documentIds, folderIds });
    if (!res.ok) toast({ tone: "error", title: "Delete failed", description: res.error });
    else toast({ tone: "default", title: `Deleted ${n} item${n > 1 ? "s" : ""}` });
    router.refresh();
  }

  async function onRequest() {
    if (!reqClient || reqTitle.trim().length < 2) return;
    setRequestOpen(false);
    const res = await requestDocument({ clientId: reqClient, title: reqTitle.trim(), note: reqNote.trim() || undefined });
    if (!res.ok) toast({ tone: "error", title: "Couldn't send request", description: res.error });
    else toast({ tone: "success", title: "Document requested", description: `${clientName.get(reqClient) ?? "Client"} will see it in their portal` });
    setReqClient(null);
    setReqTitle("");
    setReqNote("");
    router.refresh();
  }

  /* ── Upload (presigned → PUT → confirm) + download ───────────────────── */
  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    if (!storageEnabled) {
      toast({ tone: "default", title: "Switch on Phila Storage", description: "An admin enables it in Admin → Integrations before uploads work." });
      return;
    }
    setUploading((n) => n + list.length);
    let done = 0;
    for (const file of list) {
      try {
        const type = file.type || "application/octet-stream";
        const req = await requestUpload({ name: file.name, contentType: type, bytes: file.size, folderId: cwd });
        if (!req.ok) { toast({ tone: "error", title: file.name, description: req.error }); continue; }
        const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
        if (!put.ok) { toast({ tone: "error", title: file.name, description: "Upload failed." }); continue; }
        const conf = await confirmUpload({ documentId: req.documentId, bytes: file.size });
        if (!conf.ok) { toast({ tone: "error", title: file.name, description: conf.error }); continue; }
        done++;
      } catch {
        toast({ tone: "error", title: file.name, description: "Upload failed." });
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
    if (done) toast({ tone: "success", title: `Uploaded ${done} file${done > 1 ? "s" : ""}` });
    router.refresh();
  }

  async function downloadDoc(documentId: string) {
    const res = await signDownload({ documentId });
    if (!res.ok) { toast({ tone: "error", title: "Can't open this file", description: res.error }); return; }
    window.open(res.url, "_blank", "noopener");
  }

  /* ── Derived view data ───────────────────────────────────────────────── */
  const reviewDocs = docs.filter((d) => d.sharedBy === "client" || d.scanStatus === "pending");
  const openRequests = requests.filter((r) => r.status === "pending").length;
  const subFolders = childFolders(cwd);
  const folderDocs = docsIn(cwd);
  const usedPct = usage.bytesLimit ? Math.min(100, Math.round((usage.bytesUsed / usage.bytesLimit) * 100)) : 0;
  const selCount = selected.size;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      {/* ── Left: views + folder tree ──────────────────────────────────── */}
      <aside className="space-y-4">
        <nav className="rounded-card border border-border bg-surface p-1.5">
          <ViewButton active={view === "folders"} onClick={() => setView("folders")} icon={FolderClosed} label="All documents" />
          <ViewButton active={view === "review"} onClick={() => setView("review")} icon={Inbox} label="Needs review" badge={reviewDocs.length || undefined} />
          <ViewButton active={view === "byClient"} onClick={() => setView("byClient")} icon={Users} label="By client" />
        </nav>

        {view === "folders" && (
          <div className="rounded-card border border-border bg-surface p-2">
            <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-text-3">Folders</div>
            <FolderRow
              label="Home"
              icon={cwd === null ? FolderOpen : FolderClosed}
              depth={0}
              active={cwd === null}
              dropping={dropTarget === "root"}
              onClick={() => setCwd(null)}
              onDragOver={(e) => { e.preventDefault(); setDropTarget("root"); }}
              onDragLeave={() => setDropTarget((t) => (t === "root" ? null : t))}
              onDrop={() => onDropFolder(null)}
            />
            <Tree
              folders={folders}
              parentId={null}
              depth={1}
              cwd={cwd}
              dropTarget={dropTarget}
              setCwd={setCwd}
              onDragOver={(id) => setDropTarget(id)}
              onDragLeaveId={(id) => setDropTarget((t) => (t === id ? null : t))}
              onDropId={(id) => onDropFolder(id)}
            />
          </div>
        )}

        <div className="rounded-card border border-border bg-surface p-3.5">
          <div className="flex items-center gap-2 text-[12px] font-medium text-text-2">
            <HardDrive className="size-4 text-text-3" aria-hidden /> Storage
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={cn("h-full rounded-full transition-[width] duration-500", usedPct > 90 ? "bg-danger" : "bg-accent")} style={{ width: `${usedPct}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-text-3">
            {sizeLabel(usage.bytesUsed)} of {sizeLabel(usage.bytesLimit)} used
          </p>
        </div>
      </aside>

      {/* ── Right: toolbar + content ───────────────────────────────────── */}
      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Breadcrumb */}
          <div className="flex min-w-0 items-center gap-1 text-[13.5px]">
            <button type="button" onClick={() => setCwd(null)} className="rounded-control px-1.5 py-1 font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
              Home
            </button>
            {breadcrumb.map((f) => (
              <span key={f.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0 text-text-3" aria-hidden />
                <button type="button" onClick={() => setCwd(f.id)} className="truncate rounded-control px-1.5 py-1 text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
                  {f.name}
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRequestOpen(true)}>
              <Inbox className="size-4" aria-hidden /> Request{openRequests ? ` (${openRequests})` : ""}
            </Button>
            <Button variant="subtle" size="sm" onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="size-4" aria-hidden /> New folder
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }}
              aria-hidden
            />
            <Button
              size="sm"
              loading={uploading > 0}
              onClick={() =>
                storageEnabled
                  ? fileInput.current?.click()
                  : toast({ tone: "default", title: "Switch on Phila Storage", description: "An admin enables it in Admin → Integrations before uploads work." })
              }
            >
              <Upload className="size-4" aria-hidden /> {uploading > 0 ? `Uploading ${uploading}…` : "Upload"}
            </Button>
          </div>
        </div>

        {view === "folders" && (
          <div
            className={cn("min-h-[300px] rounded-card border border-border bg-surface p-3 transition-colors", dropTarget === "root" && "border-accent/60 bg-accent/5")}
            onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
            onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); void uploadFiles(e.dataTransfer.files); } }}
          >
            {subFolders.length === 0 && folderDocs.length === 0 ? (
              <EmptyState icon={FolderOpen} title="This folder is empty" body="Create a subfolder, or drag files in once uploads are switched on." />
            ) : (
              <>
                {subFolders.length > 0 && (
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {subFolders.map((f) => (
                      <FolderCard
                        key={f.id}
                        folder={f}
                        count={docsIn(f.id).length + childFolders(f.id).length}
                        selected={selected.has(fk(f.id))}
                        dropping={dropTarget === f.id}
                        renaming={renaming?.id === f.id ? renaming.value : null}
                        onOpen={() => setCwd(f.id)}
                        onSelect={(additive) => toggle(fk(f.id), additive)}
                        onRenameStart={() => setRenaming({ id: f.id, value: f.name })}
                        onRenameChange={(v) => setRenaming({ id: f.id, value: v })}
                        onRenameCommit={commitRename}
                        onDragStart={(e) => onDragStart(e, fk(f.id))}
                        onDragOver={(e) => { e.preventDefault(); setDropTarget(f.id); }}
                        onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
                        onDrop={() => onDropFolder(f.id)}
                      />
                    ))}
                  </div>
                )}
                <ul className="space-y-1.5">
                  {folderDocs.map((d) => (
                    <DocRow
                      key={d.id}
                      doc={d}
                      clientName={d.clientId ? clientName.get(d.clientId) : undefined}
                      selected={selected.has(dk(d.id))}
                      onSelect={(additive) => toggle(dk(d.id), additive)}
                      onDragStart={(e) => onDragStart(e, dk(d.id))}
                      onDownload={() => downloadDoc(d.id)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {view === "review" && (
          <div className="min-h-[300px] rounded-card border border-border bg-surface p-3">
            {reviewDocs.length === 0 ? (
              <EmptyState icon={Inbox} title="Nothing to review" body="Documents your clients upload land here for a quick look." />
            ) : (
              <ul className="space-y-1.5">
                {reviewDocs.map((d) => (
                  <DocRow key={d.id} doc={d} clientName={d.clientId ? clientName.get(d.clientId) : undefined} selected={selected.has(dk(d.id))} onSelect={(additive) => toggle(dk(d.id), additive)} onDragStart={(e) => onDragStart(e, dk(d.id))} onDownload={() => downloadDoc(d.id)} />
                ))}
              </ul>
            )}
          </div>
        )}

        {view === "byClient" && (
          <div className="min-h-[300px] space-y-4 rounded-card border border-border bg-surface p-3">
            {clients.filter((c) => docs.some((d) => d.clientId === c.id)).length === 0 ? (
              <EmptyState icon={Users} title="No client documents yet" body="Assign documents to a client and they'll group here." />
            ) : (
              clients
                .filter((c) => docs.some((d) => d.clientId === c.id))
                .map((c) => (
                  <div key={c.id}>
                    <div className="mb-1.5 px-1 text-[12.5px] font-semibold text-text">{c.name}</div>
                    <ul className="space-y-1.5">
                      {docs.filter((d) => d.clientId === c.id).map((d) => (
                        <DocRow key={d.id} doc={d} selected={selected.has(dk(d.id))} onSelect={(additive) => toggle(dk(d.id), additive)} onDragStart={(e) => onDragStart(e, dk(d.id))} onDownload={() => downloadDoc(d.id)} />
                      ))}
                    </ul>
                  </div>
                ))
            )}
          </div>
        )}
      </section>

      {/* ── Floating selection action bar ──────────────────────────────── */}
      {selCount > 0 && (
        <div className="rise fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1.5 shadow-[var(--shadow-card)]">
            <span className="px-2.5 text-[13px] font-medium text-text">{selCount} selected</span>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <ActionChip icon={UserPlus} label="Assign" onClick={() => setAssignOpen(true)} disabled={selectedDocIds().length === 0} />
            <ActionChip icon={Share2} label="Share" onClick={() => setShareOpen(true)} />
            <ActionChip icon={Trash2} label="Delete" onClick={onDelete} />
            <button type="button" onClick={clearSel} className="ml-1 inline-flex size-8 items-center justify-center rounded-full text-text-3 transition-colors hover:bg-surface-hover hover:text-text" aria-label="Clear selection">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      <Dialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="New folder"
        description={cwd ? `Inside ${breadcrumb.at(-1)?.name}` : "At the top level"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={onCreateFolder} disabled={!newFolderName.trim()}>Create folder</Button>
          </div>
        }
      >
        <Input autoFocus placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onCreateFolder()} />
      </Dialog>

      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign to a client"
        description={`${selectedDocIds().length} document${selectedDocIds().length > 1 ? "s" : ""} → a client's record`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={onAssign} disabled={!assignClient}>Assign</Button>
          </div>
        }
      >
        <Select value={assignClient} onChange={setAssignClient} placeholder="Choose a client…" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
      </Dialog>

      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share with counsellors"
        description="They'll see these in their own workspace, on top of their own clients' files."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={onShare} disabled={shareWith.size === 0}>Share</Button>
          </div>
        }
      >
        <div className="space-y-1">
          {counsellors.length === 0 ? (
            <p className="text-[13px] text-text-3">No counsellors to share with yet.</p>
          ) : (
            counsellors.map((c) => {
              const on = shareWith.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setShareWith((prev) => { const n = new Set(prev); if (on) n.delete(c.id); else n.add(c.id); return n; })}
                  className={cn("flex w-full items-center justify-between rounded-control px-3 py-2.5 text-left text-[13.5px] transition-colors", on ? "bg-accent/10 text-text" : "hover:bg-surface-hover text-text-2")}
                >
                  <span>{c.name}</span>
                  <span className={cn("inline-flex size-4 items-center justify-center rounded-[5px] border", on ? "border-accent bg-accent text-white" : "border-border")}>
                    {on && <X className="size-3 rotate-45" aria-hidden />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </Dialog>

      <Dialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a document"
        description="The client sees this in their portal and uploads against it. No unsolicited uploads."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={onRequest} disabled={!reqClient || reqTitle.trim().length < 2}>Send request</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select value={reqClient} onChange={setReqClient} placeholder="Which client?" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
          <Input placeholder="What do you need? e.g. Copy of your ID" value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} />
          <Input placeholder="A short note (optional)" value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
        </div>
      </Dialog>
    </div>
  );
}

/* ── Small presentational pieces ───────────────────────────────────────── */

function ViewButton({ active, onClick, icon: Icon, label, badge }: { active: boolean; onClick: () => void; icon: typeof FolderClosed; label: string; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13.5px] transition-colors", active ? "bg-accent/10 font-medium text-text" : "text-text-2 hover:bg-surface-hover")}
    >
      <Icon className={cn("size-4", active ? "text-accent" : "text-text-3")} aria-hidden />
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-accent/15 px-1.5 text-[11px] font-semibold text-accent">{badge}</span> : null}
    </button>
  );
}

function Tree({ folders, parentId, depth, cwd, dropTarget, setCwd, onDragOver, onDragLeaveId, onDropId }: {
  folders: DocumentFolder[]; parentId: string | null; depth: number; cwd: string | null; dropTarget: string | "root" | null;
  setCwd: (id: string) => void; onDragOver: (id: string) => void; onDragLeaveId: (id: string) => void; onDropId: (id: string) => void;
}) {
  const children = folders.filter((f) => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
  if (!children.length) return null;
  return (
    <>
      {children.map((f) => (
        <div key={f.id}>
          <FolderRow
            label={f.name}
            icon={cwd === f.id ? FolderOpen : FolderClosed}
            depth={depth}
            active={cwd === f.id}
            dropping={dropTarget === f.id}
            onClick={() => setCwd(f.id)}
            onDragOver={(e) => { e.preventDefault(); onDragOver(f.id); }}
            onDragLeave={() => onDragLeaveId(f.id)}
            onDrop={() => onDropId(f.id)}
          />
          <Tree folders={folders} parentId={f.id} depth={depth + 1} cwd={cwd} dropTarget={dropTarget} setCwd={setCwd} onDragOver={onDragOver} onDragLeaveId={onDragLeaveId} onDropId={onDropId} />
        </div>
      ))}
    </>
  );
}

function FolderRow({ label, icon: Icon, depth, active, dropping, onClick, onDragOver, onDragLeave, onDrop }: {
  label: string; icon: typeof FolderClosed; depth: number; active: boolean; dropping: boolean;
  onClick: () => void; onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ paddingLeft: 8 + depth * 14 }}
      className={cn(
        "flex w-full items-center gap-2 rounded-control py-1.5 pr-2 text-left text-[13px] transition-colors",
        active ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:bg-surface-hover",
        dropping && "ring-2 ring-accent/60 ring-inset bg-accent/5",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-text-3")} aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

function FolderCard({ folder, count, selected, dropping, renaming, onOpen, onSelect, onRenameStart, onRenameChange, onRenameCommit, onDragStart, onDragOver, onDragLeave, onDrop }: {
  folder: DocumentFolder; count: number; selected: boolean; dropping: boolean; renaming: string | null;
  onOpen: () => void; onSelect: (additive: boolean) => void; onRenameStart: () => void; onRenameChange: (v: string) => void; onRenameCommit: () => void;
  onDragStart: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={(e) => (e.metaKey || e.ctrlKey ? onSelect(true) : onOpen())}
      onDoubleClick={onOpen}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-card border bg-surface-2/40 p-3 transition-all",
        selected ? "border-accent ring-1 ring-accent/40" : "border-border hover:border-border-strong hover:bg-surface-hover",
        dropping && "border-accent ring-2 ring-accent/50 bg-accent/5 scale-[1.02]",
      )}
    >
      <FolderClosed className="size-7 shrink-0 text-accent/80" strokeWidth={1.6} aria-hidden />
      <div className="min-w-0 flex-1">
        {renaming !== null ? (
          <input
            autoFocus
            value={renaming}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => { if (e.key === "Enter") onRenameCommit(); }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-[6px] border border-accent/50 bg-surface px-1.5 py-0.5 text-[13px] text-text outline-none"
          />
        ) : (
          <div className="truncate text-[13.5px] font-medium text-text">{folder.name}</div>
        )}
        <div className="text-[11.5px] text-text-3">{count} item{count === 1 ? "" : "s"}</div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRenameStart(); }}
        className="absolute right-2 top-2 hidden size-7 items-center justify-center rounded-control text-text-3 transition-colors hover:bg-surface-hover hover:text-text group-hover:flex"
        aria-label={`Rename ${folder.name}`}
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function DocRow({ doc, clientName, selected, onSelect, onDragStart, onDownload }: {
  doc: Document; clientName?: string; selected: boolean; onSelect: (additive: boolean) => void; onDragStart: (e: React.DragEvent) => void; onDownload: () => void;
}) {
  const openable = doc.scanStatus === "clean" && Boolean(doc.storageKey);
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onClick={(e) => onSelect(e.metaKey || e.ctrlKey || e.shiftKey)}
      onDoubleClick={() => openable && onDownload()}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-card border p-2.5 transition-colors",
        selected ? "border-accent bg-accent/5" : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-3">
        <FileText className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-text">{doc.name}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-3">
          <span>{sizeLabel(doc.bytes)}</span>
          <span>· {dateLabel(doc.createdAt)}</span>
          {clientName && <span>· {clientName}</span>}
        </div>
      </div>
      {doc.scanStatus === "pending" && <Chip tone="warn" label="Scanning…" />}
      {doc.scanStatus === "quarantined" && <Chip tone="danger" icon={ShieldAlert} label="Quarantined" />}
      {doc.sharedBy === "client" && <Chip tone="accent" label="From client" />}
      {doc.visibility === "client_visible" && <Chip tone="muted" label="Visible to client" />}
      {openable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-text-3 opacity-0 transition-opacity hover:bg-surface-hover hover:text-text group-hover:opacity-100"
          aria-label={`Open ${doc.name}`}
        >
          <Download className="size-[17px]" strokeWidth={1.9} aria-hidden />
        </button>
      )}
    </li>
  );
}

function Chip({ tone, label, icon: Icon }: { tone: "warn" | "danger" | "accent" | "muted"; label: string; icon?: typeof ShieldAlert }) {
  const tones = {
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger/10 text-danger",
    accent: "bg-accent/10 text-accent",
    muted: "bg-surface-2 text-text-3",
  } as const;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium", tones[tone])}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {label}
    </span>
  );
}

function ActionChip({ icon: Icon, label, onClick, disabled }: { icon: typeof MoveRight; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="size-4" aria-hidden /> {label}
    </button>
  );
}
