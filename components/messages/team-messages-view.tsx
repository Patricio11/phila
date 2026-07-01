"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Lock, MessagesSquare, PenSquare, Search, Send, UsersRound } from "lucide-react";
import type { TeamThread } from "@/lib/data-provider";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createGroup, markThreadRead, sendTeamMessage } from "@/app/app/messages/actions";
import { cn } from "@/lib/utils";

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function dayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

interface Teammate { userId: string; name: string; role: TeamRole }

export function TeamMessagesView({ threads: initial, teammates = [] }: { threads: TeamThread[]; teammates?: Teammate[] }) {
  const { toast } = useToast();
  const [threads, setThreads] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const visible = useMemo(
    () => threads.filter((t) => t.otherName.toLowerCase().includes(query.trim().toLowerCase())),
    [threads, query],
  );
  const startable = teammates.filter((m) => !threads.some((t) => t.otherUserId === m.userId));

  const openThread = (id: string) => {
    setActiveId(id);
    setMobileThread(true);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
    void markThreadRead(id);
  };

  const startConversation = () => {
    const mate = teammates.find((m) => m.userId === newUserId);
    if (!mate) return;
    const id = `local_${mate.userId}`;
    if (!threads.some((t) => t.otherUserId === mate.userId)) {
      setThreads((prev) => [{ id, kind: "direct", otherUserId: mate.userId, otherName: mate.name, otherRole: mate.role, unread: 0, lastAt: "", messages: [] }, ...prev]);
    }
    setNewOpen(false);
    setNewUserId(null);
    setActiveId(id);
    setMobileThread(true);
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !active) return;
    const msg = { id: `local_${active.messages.length}_${active.id}`, from: "me" as const, text, at: new Date().toISOString() };
    setThreads((prev) => prev.map((t) => (t.id === active.id ? { ...t, messages: [...t.messages, msg], lastAt: msg.at } : t)));
    setDraft("");
    void sendTeamMessage({
      threadId: active.id.startsWith("local_") ? undefined : active.id,
      toUserId: active.otherUserId || undefined,
      text,
    }).then((res) => {
      if (!res.ok) toast({ tone: "error", title: res.error });
    });
  };

  const toggleGroupMember = (userId: string) =>
    setGroupMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const createGroupNow = () => {
    const title = groupTitle.trim();
    const memberUserIds = [...groupMembers];
    if (title.length < 2 || memberUserIds.length === 0) return;
    setCreating(true);
    void createGroup({ title, memberUserIds }).then((res) => {
      setCreating(false);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const thread: TeamThread = {
        id: res.threadId, kind: "group", otherUserId: "", otherName: title, otherRole: "counsellor",
        memberCount: memberUserIds.length + 1, unread: 0, lastAt: new Date().toISOString(), messages: [],
      };
      setThreads((prev) => [thread, ...prev]);
      setActiveId(res.threadId);
      setMobileThread(true);
      setGroupOpen(false);
      setGroupTitle("");
      setGroupMembers(new Set());
      toast({ tone: "success", title: "Group created", description: title });
    });
  };

  if (threads.length === 0 && startable.length === 0) {
    return <EmptyState icon={MessagesSquare} title="No team messages yet" body="Messages with your colleagues will appear here." />;
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      <div className="grid h-[calc(100dvh-220px)] min-h-[420px] grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Thread list */}
        <div className={cn("flex flex-col border-r border-border", mobileThread && "hidden lg:flex")}>
          <div className="flex items-center gap-2 border-b border-border p-2.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team…" className="h-8 w-full rounded-control border border-border bg-surface pl-8 pr-2 text-[12.5px] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" />
            </div>
            {teammates.length > 0 && (
              <button type="button" onClick={() => setGroupOpen(true)} aria-label="New group" className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
                <UsersRound className="size-4" strokeWidth={2} aria-hidden />
              </button>
            )}
            {startable.length > 0 && (
              <button type="button" onClick={() => setNewOpen(true)} aria-label="New message" className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
                <PenSquare className="size-4" strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-3.5 py-6 text-center text-[12.5px] text-text-3">No matches.</li>
            ) : visible.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => openThread(t.id)} className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover", activeId === t.id && "bg-accent-soft/40")}>
                  <ThreadAvatar thread={t} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-medium text-text">{t.otherName}</span>
                      <span className="shrink-0 text-[11px] text-text-3">{t.lastAt ? timeOf(t.lastAt) : ""}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] text-text-2">{t.messages[t.messages.length - 1]?.text ?? (t.kind === "group" ? `${t.memberCount ?? 0} members` : TEAM_ROLE_LABELS[t.otherRole])}</span>
                      {t.unread > 0 && <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink">{t.unread}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Thread */}
        <div className={cn("flex flex-col", !mobileThread && "hidden lg:flex")}>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <button type="button" onClick={() => setMobileThread(false)} className="lg:hidden" aria-label="Back to conversations"><ArrowLeft className="size-5 text-text-2" aria-hidden /></button>
                <ThreadAvatar thread={active} size="sm" />
                <div className="min-w-0">
                  <div className="text-[14px] font-[600] leading-tight text-text">{active.otherName}</div>
                  <div className="text-[11px] text-text-3">{active.kind === "group" ? `${active.memberCount ?? 0} members` : TEAM_ROLE_LABELS[active.otherRole]}</div>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto bg-surface-2/40 p-4">
                {active.messages.length === 0 && <p className="pt-8 text-center text-[12.5px] text-text-3">Start the conversation with {active.otherName.split(" ")[0]}.</p>}
                {active.messages.map((m, i) => {
                  const showDay = i === 0 || dayOf(m.at) !== dayOf(active.messages[i - 1]!.at);
                  return (
                    <div key={m.id}>
                      {showDay && <div className="my-2 text-center text-[11px] text-text-3">{dayOf(m.at)}</div>}
                      <div className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed", m.from === "me" ? "bg-accent text-accent-ink" : "bg-surface text-text shadow-sm")}>
                          {m.from === "them" && m.senderName && <div className="mb-0.5 text-[11px] font-semibold text-accent">{m.senderName}</div>}
                          {m.text}
                          <div className={cn("mt-1 text-[10px]", m.from === "me" ? "text-accent-ink/70" : "text-text-3")}>{timeOf(m.at)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-text-3">
                  <Lock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> Internal  private to your team. Client reminders go out by SMS/WhatsApp, not here.
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`Message ${active.otherName.split(" ")[0]}…`}
                    rows={1}
                    className="max-h-32 min-h-[40px] flex-1 resize-none rounded-control border border-border bg-surface px-3 py-2 text-[14px] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  />
                  <button type="button" onClick={send} disabled={!draft.trim()} aria-label="Send" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-accent text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50">
                    <Send className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-text-3">Select a conversation</div>
          )}
        </div>
      </div>

      <Dialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New message"
        description="Start a conversation with a colleague."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={startConversation} disabled={!newUserId}>Start</Button>
          </div>
        }
      >
        <Select value={newUserId} onChange={setNewUserId} placeholder="Choose a colleague" options={startable.map((m) => ({ value: m.userId, label: `${m.name} · ${TEAM_ROLE_LABELS[m.role]}` }))} />
      </Dialog>

      <Dialog
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        title="New group"
        description="Name it and add the teammates who should be in it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGroupOpen(false)}>Cancel</Button>
            <Button onClick={createGroupNow} loading={creating} disabled={groupTitle.trim().length < 2 || groupMembers.size === 0}>Create group</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input placeholder="Group name — e.g. Intake team" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} />
          <div className="text-[12px] font-medium text-text-2">Members{groupMembers.size > 0 ? ` · ${groupMembers.size} selected` : ""}</div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {teammates.map((m) => {
              const on = groupMembers.has(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => toggleGroupMember(m.userId)}
                  className={cn("flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors", on ? "bg-accent/10" : "hover:bg-surface-hover")}
                >
                  <Avatar name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-text">{m.name}</div>
                    <div className="text-[11px] text-text-3">{TEAM_ROLE_LABELS[m.role]}</div>
                  </div>
                  <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border", on ? "border-accent bg-accent text-white" : "border-border")}>
                    {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ThreadAvatar({ thread, size }: { thread: TeamThread; size: "sm" | "md" }) {
  if (thread.kind === "group") {
    return (
      <span className={cn(size === "md" ? "size-9" : "size-8", "inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent")}>
        <UsersRound className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
    );
  }
  return <Avatar name={thread.otherName} size={size} />;
}
