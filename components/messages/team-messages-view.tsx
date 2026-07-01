"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Check, Lock, MessagesSquare, Pencil, PenSquare, Search, Send, Trash2, UsersRound, X } from "lucide-react";
import type { TeamThread } from "@/lib/data-provider";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createGroup, deleteMessage, editMessage, markThreadRead, sendTeamMessage } from "@/app/app/messages/actions";
import { cn } from "@/lib/utils";

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function dayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

interface Teammate { userId: string; name: string; role: TeamRole }
type RealtimeConfig = { url: string; anonKey: string } | null;

export function TeamMessagesView({
  threads: initial,
  teammates = [],
  realtime = null,
  myUserId = "",
  orgId = "",
}: {
  threads: TeamThread[];
  teammates?: Teammate[];
  realtime?: RealtimeConfig;
  myUserId?: string;
  orgId?: string;
}) {
  const { toast } = useToast();
  const [threads, setThreads] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<{ threadId: string; name: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const activeIdRef = useRef(activeId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const teammatesRef = useRef(teammates);
  useEffect(() => { teammatesRef.current = teammates; }, [teammates]);
  const [newOpen, setNewOpen] = useState(false);
  const [newQuery, setNewQuery] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const visible = useMemo(
    () => threads.filter((t) => t.otherName.toLowerCase().includes(query.trim().toLowerCase())),
    [threads, query],
  );
  const matchName = (q: string) => (m: Teammate) => m.name.toLowerCase().includes(q.trim().toLowerCase());

  // Keep the active thread readable inside the (stable) realtime handler.
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Auto-scroll to the newest message when the open thread changes or grows.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.id, active?.messages.length]);

  // Supabase Realtime: live message delivery (per-thread channels) + org presence.
  const rtUrl = realtime?.url;
  const rtKey = realtime?.anonKey;
  const threadKey = threads.map((t) => t.id).filter((id) => !id.startsWith("local_")).sort().join(",");
  useEffect(() => {
    if (!rtUrl || !rtKey || !myUserId) return;
    const supabase = createClient(rtUrl, rtKey, { realtime: { params: { eventsPerSecond: 10 } } });
    const channels = channelsRef.current;

    const presence = supabase.channel(`presence:org:${orgId}`, { config: { presence: { key: myUserId } } });
    presence.on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(presence.presenceState()))));
    presence.subscribe((status) => { if (status === "SUBSCRIBED") void presence.track({ userId: myUserId }); });

    // Per-user channel: "you were added to a group" arrives live.
    const userCh = supabase.channel(`user:${myUserId}`);
    userCh.on("broadcast", { event: "thread_added" }, ({ payload }) => {
      const p = payload as { id: string; title: string; memberCount: number };
      setThreads((prev) =>
        prev.some((t) => t.id === p.id)
          ? prev
          : [{ id: p.id, kind: "group", otherUserId: "", otherName: p.title, otherRole: "counsellor", memberCount: p.memberCount, unread: 0, lastAt: new Date().toISOString(), messages: [] }, ...prev],
      );
    });
    userCh.subscribe();

    const ids = threadKey ? threadKey.split(",") : [];
    const chans = ids.map((id) => {
      const ch = supabase.channel(`thread:${id}`);
      ch.on("broadcast", { event: "message" }, ({ payload }) => {
        const p = payload as { threadId: string; id: string; senderId: string; text: string; at: string; senderName?: string };
        if (p.senderId === myUserId) return; // our own message is already shown optimistically
        setThreads((prev) => prev.map((t) => {
          if (t.id !== p.threadId || t.messages.some((m) => m.id === p.id)) return t;
          const msg = { id: p.id, from: "them" as const, text: p.text, at: p.at, senderName: p.senderName };
          return { ...t, messages: [...t.messages, msg], lastAt: p.at, unread: activeIdRef.current === p.threadId ? 0 : t.unread + 1 };
        }));
        if (activeIdRef.current === p.threadId) void markThreadRead(p.threadId);
        setTyping((cur) => (cur?.threadId === p.threadId ? null : cur));
      });
      ch.on("broadcast", { event: "typing" }, ({ payload }) => {
        const uid = (payload as { userId: string }).userId;
        if (uid === myUserId) return;
        const name = teammatesRef.current.find((m) => m.userId === uid)?.name ?? "Someone";
        setTyping({ threadId: id, name });
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(null), 3500);
      });
      ch.on("broadcast", { event: "update" }, ({ payload }) => {
        const u = payload as { messageId: string; text: string; edited: boolean; deleted: boolean };
        setThreads((prev) => prev.map((t) => (t.id !== id ? t : { ...t, messages: t.messages.map((m) => (m.id === u.messageId ? { ...m, text: u.deleted ? "" : u.text, edited: u.edited, deleted: u.deleted } : m)) })));
      });
      ch.subscribe();
      channels.set(id, ch);
      return ch;
    });

    return () => {
      void presence.unsubscribe();
      void userCh.unsubscribe();
      chans.forEach((c) => void c.unsubscribe());
      channels.clear();
      void supabase.removeAllChannels();
    };
  }, [rtUrl, rtKey, myUserId, orgId, threadKey]);

  const openThread = (id: string) => {
    setActiveId(id);
    setMobileThread(true);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
    void markThreadRead(id);
  };

  // Broadcast a throttled "typing" ping on the active thread's channel.
  const emitTyping = (threadId: string | null) => {
    if (!threadId || threadId.startsWith("local_") || !myUserId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    void channelsRef.current.get(threadId)?.send({ type: "broadcast", event: "typing", payload: { userId: myUserId } });
  };

  const patchMessage = (threadId: string, messageId: string, patch: Partial<{ text: string; edited: boolean; deleted: boolean }>) =>
    setThreads((prev) => prev.map((t) => (t.id !== threadId ? t : { ...t, messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) })));

  const saveEdit = () => {
    const text = editDraft.trim();
    const id = editingId;
    if (!id || !active || !text) return;
    patchMessage(active.id, id, { text, edited: true });
    setEditingId(null);
    void editMessage({ messageId: id, text }).then((res) => { if (!res.ok) toast({ tone: "error", title: res.error }); });
  };

  const doDelete = (messageId: string) => {
    if (!active) return;
    patchMessage(active.id, messageId, { deleted: true, text: "" });
    void deleteMessage(messageId).then((res) => { if (!res.ok) toast({ tone: "error", title: res.error }); });
  };

  // Open an existing 1:1 with a colleague, or start a fresh one.
  const startWith = (mate: Teammate) => {
    const existing = threads.find((t) => t.kind === "direct" && t.otherUserId === mate.userId);
    if (existing) {
      setActiveId(existing.id);
    } else {
      const id = `local_${mate.userId}`;
      setThreads((prev) => [{ id, kind: "direct", otherUserId: mate.userId, otherName: mate.name, otherRole: mate.role, unread: 0, lastAt: "", messages: [] }, ...prev]);
      setActiveId(id);
    }
    setMobileThread(true);
    setNewOpen(false);
    setNewQuery("");
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

  if (threads.length === 0 && teammates.length === 0) {
    return <EmptyState icon={MessagesSquare} title="No team messages yet" body="Messages with your colleagues will appear here." />;
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      <div className="grid h-[calc(100dvh-220px)] min-h-[420px] grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Thread list */}
        <div className={cn("flex min-h-0 flex-col border-r border-border", mobileThread && "hidden lg:flex")}>
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
            {teammates.length > 0 && (
              <button type="button" onClick={() => setNewOpen(true)} aria-label="New message" className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
                <PenSquare className="size-4" strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-3.5 py-6 text-center text-[12.5px] text-text-3">No matches.</li>
            ) : visible.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => openThread(t.id)} className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover", activeId === t.id && "bg-accent-soft/40")}>
                  <ThreadAvatar thread={t} size="md" online={t.kind === "direct" && online.has(t.otherUserId)} />
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
        <div className={cn("flex min-h-0 flex-col", !mobileThread && "hidden lg:flex")}>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <button type="button" onClick={() => setMobileThread(false)} className="lg:hidden" aria-label="Back to conversations"><ArrowLeft className="size-5 text-text-2" aria-hidden /></button>
                <ThreadAvatar thread={active} size="sm" online={active.kind === "direct" && online.has(active.otherUserId)} />
                <div className="min-w-0">
                  <div className="text-[14px] font-[600] leading-tight text-text">{active.otherName}</div>
                  <div className="text-[11px] text-text-3">
                    {typing?.threadId === active.id ? (
                      <span className="text-accent">{active.kind === "group" ? `${typing.name} is typing…` : "typing…"}</span>
                    ) : active.kind === "group" ? (
                      `${active.memberCount ?? 0} members`
                    ) : online.has(active.otherUserId) ? (
                      <span className="text-emerald-600">Active now</span>
                    ) : (
                      TEAM_ROLE_LABELS[active.otherRole]
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-surface-2/40 p-4">
                {active.messages.length === 0 && <p className="pt-8 text-center text-[12.5px] text-text-3">Start the conversation with {active.otherName.split(" ")[0]}.</p>}
                {active.messages.map((m, i) => {
                  const showDay = i === 0 || dayOf(m.at) !== dayOf(active.messages[i - 1]!.at);
                  return (
                    <div key={m.id}>
                      {showDay && <div className="my-2 text-center text-[11px] text-text-3">{dayOf(m.at)}</div>}
                      <div className={cn("group flex items-end gap-1.5", m.from === "me" ? "justify-end" : "justify-start")}>
                        {editingId === m.id ? (
                          <div className="flex w-full max-w-[80%] items-end justify-end gap-1.5">
                            <textarea
                              autoFocus
                              rows={1}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditingId(null); }}
                              className="max-h-32 min-h-[38px] flex-1 resize-none rounded-2xl border border-accent/50 bg-surface px-3 py-2 text-[13.5px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                            />
                            <button type="button" onClick={saveEdit} aria-label="Save" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"><Check className="size-4" aria-hidden /></button>
                            <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-3 hover:bg-surface-hover"><X className="size-4" aria-hidden /></button>
                          </div>
                        ) : (
                          <>
                            {m.from === "me" && !m.deleted && !m.id.startsWith("local_") && (
                              <div className="mb-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <button type="button" onClick={() => { setEditingId(m.id); setEditDraft(m.text); }} aria-label="Edit message" className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-text"><Pencil className="size-3.5" aria-hidden /></button>
                                <button type="button" onClick={() => doDelete(m.id)} aria-label="Delete message" className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-danger"><Trash2 className="size-3.5" aria-hidden /></button>
                              </div>
                            )}
                            <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed", m.deleted ? "bg-surface-2 italic text-text-3" : m.from === "me" ? "bg-accent text-accent-ink" : "bg-surface text-text shadow-sm")}>
                              {m.from === "them" && m.senderName && !m.deleted && <div className="mb-0.5 text-[11px] font-semibold text-accent">{m.senderName}</div>}
                              {m.deleted ? "This message was deleted" : m.text}
                              {!m.deleted && (
                                <div className={cn("mt-1 flex items-center gap-1 text-[10px]", m.from === "me" ? "text-accent-ink/70" : "text-text-3")}>
                                  {timeOf(m.at)}{m.edited && <span>· edited</span>}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-text-3">
                  <Lock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> Internal  private to your team. Client reminders go out by SMS/WhatsApp, not here.
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); emitTyping(active.id); }}
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
        onClose={() => { setNewOpen(false); setNewQuery(""); }}
        title="New message"
        description="Search your team and tap someone to start."
      >
        <MemberSearch query={newQuery} onQuery={setNewQuery} placeholder="Search colleagues…" />
        <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
          {teammates.filter(matchName(newQuery)).length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-text-3">No colleagues found.</p>
          ) : (
            teammates.filter(matchName(newQuery)).map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => startWith(m)}
                className="flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="relative inline-flex shrink-0">
                  <Avatar name={m.name} size="sm" />
                  {online.has(m.userId) && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-emerald-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-text">{m.name}</div>
                  <div className="text-[11px] text-text-3">{online.has(m.userId) ? <span className="text-emerald-600">Active now</span> : TEAM_ROLE_LABELS[m.role]}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </Dialog>

      <Dialog
        open={groupOpen}
        onClose={() => { setGroupOpen(false); setGroupQuery(""); }}
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
          <MemberSearch query={groupQuery} onQuery={setGroupQuery} placeholder="Search colleagues…" />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {teammates.filter(matchName(groupQuery)).map((m) => {
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

function ThreadAvatar({ thread, size, online }: { thread: TeamThread; size: "sm" | "md"; online?: boolean }) {
  const inner =
    thread.kind === "group" ? (
      <span className={cn(size === "md" ? "size-9" : "size-8", "inline-flex items-center justify-center rounded-full bg-accent-soft text-accent")}>
        <UsersRound className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
    ) : (
      <Avatar name={thread.otherName} size={size} />
    );
  return (
    <span className="relative inline-flex shrink-0">
      {inner}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-emerald-500" aria-label="Online" />
      )}
    </span>
  );
}

function MemberSearch({ query, onQuery, placeholder }: { query: string; onQuery: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
      <Input placeholder={placeholder} value={query} onChange={(e) => onQuery(e.target.value)} className="pl-9" />
    </div>
  );
}
