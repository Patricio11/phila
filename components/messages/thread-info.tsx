"use client";

import { useState } from "react";
import { Check, FileText, LogOut, Pencil, Search, UserPlus, UsersRound, X } from "lucide-react";
import type { TeamThread } from "@/lib/data-provider";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addGroupMembers, leaveGroup, removeGroupMember, renameGroup } from "@/app/app/messages/actions";
import { sizeLabel } from "@/lib/documents/quota";
import { cn } from "@/lib/utils";

interface Teammate { userId: string; name: string; role: TeamRole }
type Member = { userId: string; name: string; role: TeamRole };

function longDay(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * Batch 4g - the thread's profile. A GROUP: name (rename in place), member
 * count, every member with role + online dot, add / remove members, leave.
 * A DM: the person, their role, online status, and the files shared here.
 * Rename / add / remove: the group's creator or an org admin. Leave: anyone.
 */
export function ThreadInfo({
  thread, open, onClose, myUserId, myRole, teammates, online, onRenamed, onMembers, onLeft, onOpenAttachment,
}: {
  thread: TeamThread;
  open: boolean;
  onClose: () => void;
  myUserId: string;
  myRole: TeamRole;
  teammates: Teammate[];
  online: Set<string>;
  onRenamed: (title: string) => void;
  onMembers: (members: Member[]) => void;
  onLeft: () => void;
  onOpenAttachment: (messageId: string) => void;
}) {
  const { toast } = useToast();
  const isGroup = thread.kind === "group";
  const canManage = isGroup && (thread.createdBy === myUserId || myRole === "org_admin");
  const members: Member[] = thread.members ?? [];
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(thread.otherName);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const memberIds = new Set(members.map((m) => m.userId));
  const addable = teammates.filter((t) => !memberIds.has(t.userId) && t.name.toLowerCase().includes(addQuery.trim().toLowerCase()));
  const files = thread.messages.filter((m) => m.attachment && !m.deleted);

  const saveName = () => {
    const t = title.trim();
    if (t.length < 2 || t === thread.otherName) return setRenaming(false);
    setSaving(true);
    void renameGroup({ threadId: thread.id, title: t }).then((res) => {
      setSaving(false);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onRenamed(t);
      setRenaming(false);
      toast({ tone: "success", title: "Group renamed", description: t });
    });
  };

  const addNow = () => {
    const ids = [...picked];
    if (ids.length === 0) return;
    setBusy("add");
    void addGroupMembers({ threadId: thread.id, memberUserIds: ids }).then((res) => {
      setBusy(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onMembers(res.members as Member[]);
      setPicked(new Set());
      setAdding(false);
      setAddQuery("");
      toast({ tone: "success", title: ids.length === 1 ? "Member added" : `${ids.length} members added` });
    });
  };

  const removeNow = (m: Member) => {
    setBusy(m.userId);
    void removeGroupMember({ threadId: thread.id, userId: m.userId }).then((res) => {
      setBusy(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onMembers(res.members as Member[]);
      toast({ tone: "default", title: `${m.name} removed from the group` });
    });
  };

  const leaveNow = () => {
    setBusy("leave");
    void leaveGroup({ threadId: thread.id }).then((res) => {
      setBusy(null);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      onLeft();
      toast({ tone: "default", title: "You left the group", description: thread.otherName });
    });
  };

  const other = !isGroup ? members.find((m) => m.userId !== myUserId) : null;

  return (
    <Dialog open={open} onClose={onClose} title={isGroup ? "Group info" : "Conversation info"} className="max-w-md">
      <div className="space-y-4" data-testid="thread-info">
        {/* Identity */}
        <div className="flex flex-col items-center text-center">
          {isGroup ? (
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <UsersRound className="size-7" strokeWidth={1.8} aria-hidden />
            </span>
          ) : (
            <span className="relative inline-flex">
              <Avatar name={thread.otherName} size="lg" />
              {online.has(thread.otherUserId) && <span className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-surface bg-emerald-500" aria-label="Online" />}
            </span>
          )}
          {isGroup && renaming ? (
            <div className="mt-3 flex w-full items-center gap-1.5">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setRenaming(false); setTitle(thread.otherName); } }} aria-label="Group name" autoFocus maxLength={60} />
              <Button size="sm" onClick={saveName} loading={saving} disabled={title.trim().length < 2}>Save</Button>
              <button type="button" onClick={() => { setRenaming(false); setTitle(thread.otherName); }} aria-label="Cancel rename" className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover"><X className="size-4" aria-hidden /></button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-1.5">
              <h3 className="text-[17px] font-[660] text-text">{thread.otherName}</h3>
              {canManage && (
                <button type="button" onClick={() => { setTitle(thread.otherName); setRenaming(true); }} aria-label="Rename group" title="Rename group" className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-text"><Pencil className="size-3.5" aria-hidden /></button>
              )}
            </div>
          )}
          <p className="mt-0.5 text-[12.5px] text-text-3">
            {isGroup
              ? `${members.length} member${members.length === 1 ? "" : "s"}${thread.createdAt ? ` · created ${longDay(thread.createdAt)}` : ""}`
              : online.has(thread.otherUserId) ? <span className="text-emerald-600">Active now</span> : TEAM_ROLE_LABELS[(other?.role ?? thread.otherRole) as TeamRole]}
          </p>
        </div>

        {/* Members */}
        {isGroup && (
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-3">Members</h4>
              {canManage && !adding && (
                <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"><UserPlus className="size-3.5" strokeWidth={2} aria-hidden /> Add members</button>
              )}
            </div>
            {adding && (
              <div className="mb-2 space-y-2 rounded-control border border-border bg-surface-2/40 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
                  <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)} placeholder="Search colleagues…" aria-label="Search colleagues to add" className="h-8 w-full rounded-control border border-border bg-surface pl-8 pr-2 text-[12.5px] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" />
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto">
                  {addable.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-text-3">Everyone&apos;s already in - or no match.</p>
                  ) : addable.map((t) => {
                    const on = picked.has(t.userId);
                    return (
                      <button key={t.userId} type="button" onClick={() => setPicked((p) => { const n = new Set(p); if (n.has(t.userId)) n.delete(t.userId); else n.add(t.userId); return n; })} className={cn("flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors", on ? "bg-accent/10" : "hover:bg-surface-hover")}>
                        <Avatar name={t.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-text">{t.name}</span>
                          <span className="block text-[11px] text-text-3">{TEAM_ROLE_LABELS[t.role]}</span>
                        </span>
                        <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border", on ? "border-accent bg-accent text-white" : "border-border")}>{on && <Check className="size-3" strokeWidth={3} aria-hidden />}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setPicked(new Set()); setAddQuery(""); }}>Cancel</Button>
                  <Button size="sm" onClick={addNow} loading={busy === "add"} disabled={picked.size === 0}>Add{picked.size > 0 ? ` ${picked.size}` : ""}</Button>
                </div>
              </div>
            )}
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-control border border-border">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2.5 px-2.5 py-2">
                  <span className="relative inline-flex shrink-0">
                    <Avatar name={m.name} size="sm" />
                    {online.has(m.userId) && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-emerald-500" aria-label="Online" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-text">
                      {m.name}
                      {m.userId === myUserId && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] font-medium text-text-3">you</span>}
                      {m.userId === thread.createdBy && <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-medium text-accent">created the group</span>}
                    </span>
                    <span className="block text-[11px] text-text-3">{online.has(m.userId) ? <span className="text-emerald-600">Active now</span> : TEAM_ROLE_LABELS[m.role]}</span>
                  </span>
                  {canManage && m.userId !== myUserId && m.userId !== thread.createdBy && (
                    <button type="button" onClick={() => removeNow(m)} disabled={busy === m.userId} aria-label={`Remove ${m.name}`} title="Remove from group" className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-danger disabled:opacity-50"><X className="size-4" aria-hidden /></button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Shared files */}
        <section>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">Shared files{files.length > 0 ? ` · ${files.length}` : ""}</h4>
          {files.length === 0 ? (
            <p className="text-[12.5px] text-text-3">No files shared here yet.</p>
          ) : (
            <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-control border border-border">
              {files.slice().reverse().map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onOpenAttachment(m.id)} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-surface-hover">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-3"><FileText className="size-4" strokeWidth={1.9} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-text">{m.attachment!.name}</span>
                      <span className="block text-[10.5px] text-text-3">{sizeLabel(m.attachment!.bytes)}{m.senderName ? ` · ${m.senderName}` : m.from === "me" ? " · you" : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Leave */}
        {isGroup && (
          <section className="border-t border-border pt-3">
            {confirmLeave ? (
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-text-2">
                <span className="min-w-0 flex-1">Leave <b>{thread.otherName}</b>? You&apos;ll stop seeing its messages.</span>
                <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(false)}>Stay</Button>
                <Button size="sm" variant="danger" onClick={leaveNow} loading={busy === "leave"}>Leave group</Button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmLeave(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-danger hover:underline"><LogOut className="size-3.5" strokeWidth={2} aria-hidden /> Leave group</button>
            )}
          </section>
        )}
      </div>
    </Dialog>
  );
}
