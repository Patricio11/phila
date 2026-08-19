"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, AtSign, Check, CornerUpLeft, Download, Eye, FileText, HeartHandshake, Info, Lock, MessagesSquare, Paperclip, Pencil, PenSquare, Phone, Search, Send, ShieldCheck, SmilePlus, Trash2, UsersRound, X } from "lucide-react";
import type { TeamThread } from "@/lib/data-provider";
import { type TeamRole } from "@/lib/domain/enums";
import { roleLabel } from "@/components/messages/role-label";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createGroup, deleteMessage, editMessage, getRealtimeToken, markThreadRead, refreshThreads, requestChatUpload, sendTeamMessage, signChatAttachment, toggleReaction, listMessageableClients, startClientThread } from "@/app/app/messages/actions";
import type { MessageableClient } from "@/db/queries/messages";
import { EmojiPicker, QUICK_REACTIONS } from "@/components/messages/emoji-picker";
import { ThreadInfo } from "@/components/messages/thread-info";
import { FullPage, FullPageToggle } from "@/components/ui/full-page";
import { PushOptIn } from "@/components/push/push-opt-in";
import type { CrisisLine } from "@/lib/messaging/crisis";
import { applyMention, mentionCandidates, mentionQueryAt, splitMentions, stripMentionTokens, tokeniseMentions, type MentionMember } from "@/lib/messaging/mentions";
import { sizeLabel } from "@/lib/documents/quota";
import { cn } from "@/lib/utils";

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function dayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

interface Teammate { userId: string; name: string; role: TeamRole }
type RealtimeConfig = { url: string; anonKey: string; private: boolean } | null;

export function TeamMessagesView({
  threads: initial,
  teammates = [],
  realtime = null,
  myUserId = "",
  orgId = "",
  myRole = "counsellor",
  myName = "You",
  mode = "staff",
  initialThreadId = null,
}: {
  threads: TeamThread[];
  teammates?: Teammate[];
  realtime?: RealtimeConfig;
  myUserId?: string;
  orgId?: string;
  /** Batch 4g - who may manage a group (creator or org admin). */
  myRole?: TeamRole;
  myName?: string;
  /** Phase 34.1 - "client": the client's own portal view (reply-only, no attach, no new). */
  mode?: "staff" | "client";
  /** Land on this thread (deep link from a client page / notification). */
  initialThreadId?: string | null;
}) {
  const { toast } = useToast();
  const [threads, setThreads] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initialThreadId && initial.some((t) => t.id === initialThreadId) ? initialThreadId : initial[0]?.id ?? null);
  const isClient = mode === "client";
  const [draft, setDraft] = useState("");
  const [mobileThread, setMobileThread] = useState(Boolean(initialThreadId));
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<{ threadId: string; name: string } | null>(null);
  // Batch 4m - typing over the DB: names by thread, refreshed every 2.5 s while a thread is open.
  const [typingNames, setTypingNames] = useState<Record<string, string[]>>({});
  // Batch 4n - @mention completion: the "@query" under the caret + the highlighted row.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  // Batch 4m - crisis support lines handed back to the author (client) by the server - shown once, to them alone.
  const [support, setSupport] = useState<{ threadId: string; lines: CrisisLine[] } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [uploading, setUploading] = useState(0);
  const attachInput = useRef<HTMLInputElement>(null);
  const localSeq = useRef(0);
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
  // Batch 4g - reply, reactions, emoji, thread info.
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; text: string } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Batch 4i - full page: the chat takes the whole viewport, menus covered.
  const [full, setFull] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const visible = useMemo(
    () => threads.filter((t) => t.otherName.toLowerCase().includes(query.trim().toLowerCase())),
    [threads, query],
  );
  const matchName = (q: string) => (m: { name: string }) => m.name.toLowerCase().includes(q.trim().toLowerCase());

  // Keep the active thread readable inside the (stable) realtime handler.
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  // Phase 34.2 - a thread that opens on arrival (the first one, a ?t= deep link,
  // the client's single conversation) counts as read the moment it's on screen -
  // it moves the server cursor, clears the badge, and re-arms the message alert.
  useEffect(() => {
    if (!activeId || activeId.startsWith("local_")) return;
    void markThreadRead(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to the newest message when the open thread changes or grows.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.id, active?.messages.length]);

  // Supabase Realtime: live message delivery (per-thread channels) + org presence.
  const rtUrl = realtime?.url;
  const rtKey = realtime?.anonKey;
  const rtPrivate = realtime?.private ?? false;
  // Batch 2u - live delivery depends on an external service. When it is not
  // connected (not configured, DNS dead, network blocked), the chat quietly
  // polls instead - a reply appears in seconds, not on the next hard refresh.
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  const markLive = (on: boolean) => { liveRef.current = on; setLive(on); };
  const threadKey = threads.map((t) => t.id).filter((id) => !id.startsWith("local_")).sort().join(",");
  useEffect(() => {
    if (!rtUrl || !rtKey || !myUserId) return;
    const supabase = createClient(rtUrl, rtKey, {
      realtime: { params: { eventsPerSecond: 10 } },
      // Private mode: authenticate realtime with a scoped, RLS-checked JWT.
      ...(rtPrivate ? { accessToken: async () => (await getRealtimeToken())?.token ?? rtKey } : {}),
    });
    // An unreachable host would otherwise retry forever, flooding the console
    // with WebSocket errors while delivering nothing. Give it a fair chance,
    // then stop the socket and let the polling fallback own delivery.
    let socketFailures = 0;
    const noteFailure = () => {
      socketFailures += 1;
      markLive(false);
      if (socketFailures >= 3) {
        void supabase.removeAllChannels();
        supabase.realtime.disconnect();
      }
    };
    const channels = channelsRef.current;
    const chanConfig = { config: { private: rtPrivate } };

    const presence = supabase.channel(`presence:org:${orgId}`, { config: { private: rtPrivate, presence: { key: myUserId } } });
    presence.on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(presence.presenceState()))));
    presence.subscribe((status) => {
      if (status === "SUBSCRIBED") { markLive(true); void presence.track({ userId: myUserId }); }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") noteFailure();
      else if (status === "CLOSED") markLive(false);
    });

    // Per-user channel: a thread just appeared for me  a new group I was added to,
    // or a brand-new DM whose first message I'd otherwise miss (I'm not subscribed
    // to its channel yet). A direct payload carries that first message inline.
    const userCh = supabase.channel(`user:${myUserId}`, chanConfig);
    userCh.on("broadcast", { event: "thread_removed" }, ({ payload }) => {
      const gone = (payload as { id: string }).id;
      setThreads((prev) => prev.filter((t) => t.id !== gone));
      if (activeIdRef.current === gone) { setActiveId(null); setInfoOpen(false); }
    });
    userCh.on("broadcast", { event: "thread_added" }, ({ payload }) => {
      const p = payload as {
        id: string; kind?: "direct" | "group"; title?: string; otherUserId?: string; otherName?: string; otherRole?: TeamRole; memberCount?: number;
        message?: { id: string; senderId: string; text: string; at: string; senderName?: string; attachment?: { name: string; contentType: string; bytes: number } };
      };
      const incoming = p.message && p.message.senderId !== myUserId
        ? { id: p.message.id, from: "them" as const, text: p.message.text, at: p.message.at, senderName: p.message.senderName, attachment: p.message.attachment }
        : null;
      setThreads((prev) => {
        const existing = prev.find((t) => t.id === p.id);
        if (existing) {
          // Already known (a race, or a resend)  just append the message if it's new.
          if (!incoming || existing.messages.some((m) => m.id === incoming.id)) return prev;
          return prev.map((t) => (t.id !== p.id ? t : { ...t, messages: [...t.messages, incoming], lastAt: incoming.at, unread: activeIdRef.current === p.id ? 0 : t.unread + 1 }));
        }
        const added: TeamThread = {
          id: p.id,
          kind: p.kind ?? "group",
          otherUserId: p.otherUserId ?? "",
          otherName: p.otherName ?? p.title ?? "Team member",
          otherRole: p.otherRole ?? "counsellor",
          memberCount: p.memberCount,
          unread: incoming && activeIdRef.current !== p.id ? 1 : 0,
          lastAt: incoming?.at ?? new Date().toISOString(),
          messages: incoming ? [incoming] : [],
        };
        return [added, ...prev];
      });
    });
    userCh.subscribe();

    const ids = threadKey ? threadKey.split(",") : [];
    const chans = ids.map((id) => {
      const ch = supabase.channel(`thread:${id}`, chanConfig);
      ch.on("broadcast", { event: "message" }, ({ payload }) => {
        const p = payload as { threadId: string; id: string; senderId: string; text: string; at: string; senderName?: string; attachment?: { name: string; contentType: string; bytes: number }; replyTo?: { id: string; senderId: string; senderName: string; text: string } | null };
        if (p.senderId === myUserId) return; // our own message is already shown optimistically
        setThreads((prev) => prev.map((t) => {
          if (t.id !== p.threadId || t.messages.some((m) => m.id === p.id)) return t;
          const msg = { id: p.id, from: "them" as const, text: p.text, at: p.at, senderName: p.senderName, senderId: p.senderId, attachment: p.attachment, replyTo: p.replyTo ? { id: p.replyTo.id, senderName: p.replyTo.senderId === myUserId ? "You" : p.replyTo.senderName, text: p.replyTo.text } : null };
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
      // Batch 4g - someone reacted (or un-reacted); their own toggle is already applied locally.
      ch.on("broadcast", { event: "reaction" }, ({ payload }) => {
        const r = payload as { messageId: string; emoji: string; userId: string; added: boolean };
        if (r.userId === myUserId) return;
        setThreads((prev) => prev.map((t) => (t.id !== id ? t : { ...t, messages: t.messages.map((m) => (m.id === r.messageId ? { ...m, reactions: applyReaction(m.reactions, r.emoji, r.userId, r.added) } : m)) })));
      });
      // Batch 4g - the group was renamed or its members changed.
      ch.on("broadcast", { event: "thread_updated" }, ({ payload }) => {
        const u = payload as { title?: string; members?: { userId: string; name: string; role: TeamRole }[]; memberCount?: number };
        setThreads((prev) => prev.map((t) => (t.id !== id ? t : {
          ...t,
          otherName: u.title ?? t.otherName,
          members: u.members ?? t.members,
          memberCount: u.memberCount ?? (u.members ? u.members.length : t.memberCount),
        })));
      });
      ch.subscribe();
      channels.set(id, ch);
      return ch;
    });

    return () => {
      markLive(false);
      void presence.unsubscribe();
      void userCh.unsubscribe();
      chans.forEach((c) => void c.unsubscribe());
      channels.clear();
      void supabase.removeAllChannels();
    };
  }, [rtUrl, rtKey, rtPrivate, myUserId, orgId, threadKey]);

  // The polling fallback. Merges by message id on top of what is shown, so an
  // optimistic send is never clobbered; unread counts respect the open thread.
  useEffect(() => {
    if (live) return; // realtime is doing this job
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden || liveRef.current) return;
      const res = await refreshThreads().catch(() => null);
      if (!res || !res.ok || stopped || liveRef.current) return;
      setThreads((prev) => {
        const mine = new Map(prev.map((t) => [t.id, t]));
        const next = res.threads.map((server) => {
          const local = mine.get(server.id);
          if (!local) return server;
          const seen = new Set(local.messages.map((m) => m.id));
          const fresh = server.messages.filter((m) => !seen.has(m.id));
          const isOpen = activeIdRef.current === server.id;
          if (fresh.length > 0 && isOpen) void markThreadRead(server.id);
          // Batch 4g - reactions / edits on messages we already show, and the
          // group's name + members, follow the server too (no realtime needed).
          const byId = new Map(server.messages.map((m) => [m.id, m]));
          const merged = local.messages.map((m) => {
            const sv = byId.get(m.id);
            return sv ? { ...m, reactions: sv.reactions, text: sv.deleted ? "" : sv.text, edited: sv.edited, deleted: sv.deleted } : m;
          });
          return {
            ...local,
            otherName: server.otherName,
            members: server.members ?? local.members,
            memberCount: server.memberCount ?? local.memberCount,
            messages: fresh.length > 0 ? [...merged, ...fresh] : merged,
            lastAt: fresh.length > 0 ? server.lastAt : local.lastAt,
            unread: isOpen ? 0 : local.unread + fresh.filter((m) => m.from === "them").length,
          };
        });
        // Threads that only exist locally (an optimistic DM not yet persisted).
        // A thread the server no longer lists (removed / left) drops away.
        const serverIds = new Set(res.threads.map((t) => t.id));
        return [...next, ...prev.filter((t) => !serverIds.has(t.id) && t.id.startsWith("local_"))].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
      });
    };
    const id = setInterval(() => void tick(), 5000);
    void tick();
    return () => { stopped = true; clearInterval(id); };
  }, [live]);

  const openThread = (id: string) => {
    setActiveId(id);
    setReplyTo(null);
    setEmojiOpen(false);
    setMobileThread(true);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
    void markThreadRead(id);
  };

  // Batch 4o - New message → Clients: the third door (loaded when the tab opens).
  const [newTab, setNewTab] = useState<"team" | "clients">("team");
  const [clientList, setClientList] = useState<MessageableClient[] | null>(null);
  const [clientBusy, setClientBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!newOpen || newTab !== "clients" || isClient) return;
    let alive = true;
    listMessageableClients().then((res) => { if (alive) setClientList(res.ok ? res.clients : []); }).catch(() => { if (alive) setClientList([]); });
    return () => { alive = false; };
  }, [newOpen, newTab, isClient]);
  const startWithClient = async (c: MessageableClient) => {
    setClientBusy(c.id);
    try {
      const res = await startClientThread({ clientId: c.id });
      if (!res.ok) return toast({ tone: "error", title: "Can't open a conversation", description: res.error });
      const fresh = await refreshThreads().catch(() => null);
      if (fresh?.ok) {
        setThreads((prev) => {
          const mine = new Map(prev.map((t) => [t.id, t]));
          return fresh.threads.map((sv) => mine.get(sv.id) ?? sv);
        });
      }
      setNewOpen(false); setNewQuery(""); setNewTab("team");
      openThread(res.threadId);
      if (res.created) toast({ tone: "success", title: `Conversation with ${c.name.split(" ")[0]} opened`, description: c.hasLogin ? "They can read and reply in their portal." : "They'll get an activation link with your first message." });
    } finally {
      setClientBusy(null);
    }
  };

  // Broadcast a throttled "typing" ping on the active thread's channel.
  const emitTyping = (threadId: string | null) => {
    if (!threadId || threadId.startsWith("local_") || !myUserId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    void channelsRef.current.get(threadId)?.send({ type: "broadcast", event: "typing", payload: { userId: myUserId } });
    // Batch 4m - and the database, so the indicator works without Supabase (a plain
    // fetch: server actions from one page queue behind each other, this mustn't).
    void fetch("/api/messages/typing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId }), keepalive: true }).catch(() => {});
  };

  // Batch 4m - poll who's typing while a thread is open + the tab is visible (cheap: member rows only).
  useEffect(() => {
    if (!activeId || activeId.startsWith("local_")) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      const res = await fetch("/api/messages/typing", { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; typing: Record<string, string[]> }>) : null)).catch(() => null);
      if (!stopped && res?.ok) setTypingNames(res.typing);
    };
    void tick();
    const id = setInterval(() => void tick(), 2500);
    return () => { stopped = true; clearInterval(id); };
  }, [activeId]);

  // Batch 4m - composer + edit boxes grow with the text (up to ~6 lines), never a one-line slit.
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 176)}px`;
  };
  useEffect(() => { autoGrow(composerRef.current); }, [draft, replyTo, activeId]);

  // Batch 4n - who can be @mentioned here: everyone in the thread but me (a DM = the other person).
  const mentionMembers: MentionMember[] = active
    ? (active.members && active.members.length > 0
        ? active.members.map((m) => ({ userId: m.userId, name: m.name }))
        : active.kind === "direct" && active.otherUserId ? [{ userId: active.otherUserId, name: active.otherName }] : [])
    : [];
  const mentionOptions = mention ? mentionCandidates(mention.query, mentionMembers, myUserId) : [];
  const updateMention = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const q = mentionQueryAt(el.value, el.selectionStart ?? el.value.length);
    setMention((prev) => (q ? (prev && prev.start === q.start && prev.query === q.query ? prev : q) : null));
    if (!q) setMentionIdx(0);
  };
  const pickMention = (member: MentionMember) => {
    const el = composerRef.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? draft.length;
    const next = applyMention(draft, mention.start, caret, member);
    setDraft(next.text);
    setMention(null);
    setMentionIdx(0);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(next.caret, next.caret); autoGrow(el); });
  };
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionOptions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionOptions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionOptions.length) % mentionOptions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mentionOptions[Math.min(mentionIdx, mentionOptions.length - 1)]!); return; }
      if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const patchMessage = (threadId: string, messageId: string, patch: Partial<{ text: string; edited: boolean; deleted: boolean }>) =>
    setThreads((prev) => prev.map((t) => (t.id !== threadId ? t : { ...t, messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) })));

  const saveEdit = () => {
    const text = editDraft.trim();
    const id = editingId;
    if (!id || !active || !text) return;
    const body = tokeniseMentions(text, mentionMembers);
    patchMessage(active.id, id, { text: body, edited: true });
    setEditingId(null);
    void editMessage({ messageId: id, text: body }).then((res) => { if (!res.ok) toast({ tone: "error", title: res.error }); });
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

  // Send text and/or a file; optimistic, then reconcile the local ids with the real ones.
  const dispatch = (text: string, attachment?: { key: string; name: string; contentType: string; bytes: number }) => {
    if (!active || (!text && !attachment)) return;
    const wasThreadId = active.id;
    const localId = `local_${(localSeq.current += 1)}`;
    const quoted = replyTo;
    setReplyTo(null);
    // Batch 4n - "@Thabo Mokoena" typed plain becomes a mention token the server can trust.
    const body = tokeniseMentions(text, mentionMembers);
    const optimistic = { id: localId, from: "me" as const, text: body, at: new Date().toISOString(), senderId: myUserId, attachment: attachment ? { name: attachment.name, contentType: attachment.contentType, bytes: attachment.bytes } : undefined, replyTo: quoted };
    setThreads((prev) => prev.map((t) => (t.id === wasThreadId ? { ...t, messages: [...t.messages, optimistic], lastAt: optimistic.at } : t)));
    // Batch 4n - give the words back: a failed send returns the draft + the reply target to the box.
    const giveBack = (reason: string) => {
      setThreads((prev) => prev.map((t) => (t.id === wasThreadId ? { ...t, messages: t.messages.filter((m) => m.id !== localId) } : t)));
      setDraft((cur) => (cur.trim() ? `${text}\n${cur}` : text));
      if (quoted) setReplyTo(quoted);
      requestAnimationFrame(() => composerRef.current?.focus());
      toast({ tone: "error", title: "Couldn't send - your words are back in the box", description: reason });
    };
    void sendTeamMessage({
      threadId: wasThreadId.startsWith("local_") ? undefined : wasThreadId,
      toUserId: active.otherUserId || undefined,
      text: body,
      attachment,
      replyToId: quoted && !quoted.id.startsWith("local_") ? quoted.id : undefined,
    }).then((res) => {
      if (!res.ok) return giveBack(res.error);
      if (res.support?.length) setSupport({ threadId: res.threadId ?? wasThreadId, lines: res.support });
      const realThreadId = res.threadId;
      setThreads((prev) => prev.map((t) => (t.id !== wasThreadId ? t : {
        ...t,
        id: realThreadId ?? t.id,
        messages: t.messages.map((m) => (m.id === localId && res.messageId ? { ...m, id: res.messageId } : m)),
      })));
      if (realThreadId && wasThreadId.startsWith("local_")) setActiveId(realThreadId);
    }).catch(() => giveBack("Phila couldn't be reached. Check your connection and send again."));
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    dispatch(text);
  };

  const uploadAndSend = async (file: File) => {
    if (!active) return;
    setUploading((u) => u + 1);
    try {
      const type = file.type || "application/octet-stream";
      const req = await requestChatUpload({ name: file.name, contentType: type, bytes: file.size });
      if (!req.ok) return toast({ tone: "error", title: "Couldn't attach", description: req.error });
      const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
      if (!put.ok) return toast({ tone: "error", title: "Upload failed", description: "Please try again." });
      dispatch(draft.trim(), { key: req.key, name: file.name, contentType: type, bytes: file.size });
      setDraft("");
    } finally {
      setUploading((u) => Math.max(0, u - 1));
    }
  };

  const openAttachment = async (messageId: string) => {
    if (messageId.startsWith("local_")) return toast({ tone: "default", title: "Still sending…", description: "It'll be ready in a moment." });
    const res = await signChatAttachment({ messageId });
    if (!res.ok) return toast({ tone: "error", title: "Can't open", description: res.error });
    window.open(res.url, "_blank", "noopener");
  };

  const toggleGroupMember = (userId: string) =>
    setGroupMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  // Batch 4g - toggle my reaction (optimistic; the server broadcasts to everyone else).
  const react = (messageId: string, emoji: string) => {
    if (!active || messageId.startsWith("local_")) return;
    const has = active.messages.find((m) => m.id === messageId)?.reactions?.some((r) => r.emoji === emoji && r.userIds.includes(myUserId)) ?? false;
    setThreads((prev) => prev.map((t) => (t.id !== active.id ? t : { ...t, messages: t.messages.map((m) => (m.id === messageId ? { ...m, reactions: applyReaction(m.reactions, emoji, myUserId, !has) } : m)) })));
    setReactFor(null);
    void toggleReaction({ messageId, emoji }).then((res) => { if (!res.ok) toast({ tone: "error", title: res.error }); });
  };

  // Insert an emoji at the composer's caret.
  const insertEmoji = (emoji: string) => {
    const el = composerRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); } });
  };

  // Jump to a quoted message and flash it.
  const jumpTo = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(messageId);
    setTimeout(() => setFlashId(null), 1400);
  };

  const nameOf = (userId: string) => userId === myUserId ? "You" : (active?.members?.find((m) => m.userId === userId)?.name ?? teammates.find((m) => m.userId === userId)?.name ?? "Someone");

  const createGroupNow = () => {
    const title = groupTitle.trim();
    const memberUserIds = [...groupMembers];
    if (title.length < 2 || memberUserIds.length === 0) return;
    setCreating(true);
    void createGroup({ title, memberUserIds }).then((res) => {
      setCreating(false);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const picked = teammates.filter((m) => memberUserIds.includes(m.userId)).map((m) => ({ userId: m.userId, name: m.name, role: m.role }));
      const thread: TeamThread = {
        id: res.threadId, kind: "group", otherUserId: "", otherName: title, otherRole: "counsellor",
        memberCount: memberUserIds.length + 1, unread: 0, lastAt: new Date().toISOString(), messages: [],
        members: [{ userId: myUserId, name: myName, role: myRole }, ...picked], createdBy: myUserId, createdAt: new Date().toISOString(),
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
    return isClient
      ? <EmptyState icon={MessagesSquare} title="No messages yet" body="Your practice will message you here when there's something to share." />
      : <EmptyState icon={MessagesSquare} title="No team messages yet" body="Messages with your colleagues will appear here." />;
  }

  return (
    <FullPage open={full} onClose={() => setFull(false)} title="Messages" subtitle={active ? active.otherName : undefined} icon={MessagesSquare}>
    {/* Batch 4m - web push, offered in context (only when Phila has it on + this browser can + not decided yet) */}
    {!full && <PushOptIn variant="banner" className="mb-2.5" />}
    <div className={cn("overflow-hidden bg-surface", full ? "flex min-h-0 flex-1 flex-col" : "rounded-card border border-border shadow-sm")}>
      <div className={cn("grid grid-cols-1", full ? "min-h-0 flex-1" : "h-[calc(100dvh-220px)] min-h-[420px]", !isClient && "lg:grid-cols-[300px_1fr]")}>
        {/* Thread list - a client has exactly one conversation, so their view is the thread alone. */}
        <div className={cn("flex min-h-0 flex-col border-r border-border", mobileThread && "hidden lg:flex", isClient && "hidden")}>
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
            {!full && <FullPageToggle full={full} onToggle={() => setFull(true)} label="Open messages full page" />}
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
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-medium text-text">
                        <span className="truncate">{t.otherName}</span>
                        {t.kind === "client" && !isClient && <span className="shrink-0 rounded-full bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">Client</span>}
                      </span>
                      <span className="shrink-0 text-[11px] text-text-3">{t.lastAt ? timeOf(t.lastAt) : ""}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] text-text-2">
                        {(() => {
                          const last = t.messages[t.messages.length - 1];
                          if (last?.deleted) return "Message deleted";
                          if (last?.text) return stripMentionTokens(last.text);
                          if (last?.attachment) return `📎 ${last.attachment.name}`;
                          return t.kind === "group" ? `${t.memberCount ?? 0} members` : t.kind === "client" ? (isClient ? "Your practice" : "Client") : roleLabel(t.otherRole);
                        })()}
                      </span>
                      {t.unread > 0 && <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink">{t.unread}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Thread */}
        <div className={cn("flex min-h-0 flex-col", !mobileThread && !isClient && "hidden lg:flex")}>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                {!isClient && <button type="button" onClick={() => setMobileThread(false)} className="lg:hidden" aria-label="Back to conversations"><ArrowLeft className="size-5 text-text-2" aria-hidden /></button>}
                <button type="button" onClick={() => !active.id.startsWith("local_") && setInfoOpen(true)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control text-left transition-colors hover:bg-surface-hover -mx-1 px-1 py-0.5" aria-label={active.kind === "group" ? "Group info" : "Conversation info"} data-testid="thread-header">
                  <ThreadAvatar thread={active} size="sm" online={active.kind === "direct" && online.has(active.otherUserId)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-[600] leading-tight text-text">{active.otherName}</div>
                    <div className="truncate text-[11px] text-text-3">
                      {typing?.threadId === active.id || (typingNames[active.id]?.length ?? 0) > 0 ? (
                        <span className="text-accent">{typingLabel(active.kind, typing?.threadId === active.id ? [typing.name] : typingNames[active.id] ?? [])}</span>
                      ) : active.kind === "group" ? (
                        `${active.memberCount ?? active.members?.length ?? 0} members${active.members && active.members.length > 0 ? ` · ${active.members.slice(0, 3).map((m) => (m.userId === myUserId ? "you" : m.name.split(" ")[0])).join(", ")}${active.members.length > 3 ? ` +${active.members.length - 3}` : ""}` : ""}`
                      ) : active.kind === "client" ? (
                        isClient
                          ? `Your care team${active.members && active.members.length > 0 ? ` · ${active.members.filter((m) => m.role !== "client").slice(0, 3).map((m) => m.name.split(" ")[0]).join(", ")}` : ""}`
                          : "Client · they can read this conversation"
                      ) : online.has(active.otherUserId) ? (
                        <span className="text-emerald-600">Active now</span>
                      ) : (
                        roleLabel(active.otherRole)
                      )}
                    </div>
                  </div>
                  {active.kind === "group" && active.members && active.members.length > 0 && (
                    <span className="hidden items-center -space-x-1.5 sm:flex" aria-hidden>
                      {active.members.slice(0, 4).map((m) => <span key={m.userId} className="rounded-full ring-2 ring-surface"><Avatar name={m.name} size="sm" /></span>)}
                    </span>
                  )}
                </button>
                {!active.id.startsWith("local_") && (
                  <button type="button" onClick={() => setInfoOpen(true)} aria-label="Thread details" title={active.kind === "group" ? "Group info" : "Conversation info"} className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text">
                    <Info className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                )}
                {!full && <FullPageToggle full={full} onToggle={() => setFull(true)} label="Open messages full page" className="border-0" />}
              </div>

              {active.kind === "client" && !isClient && (
                <div className="flex items-center gap-2 border-b border-sky-200/70 bg-sky-50 px-4 py-1.5 text-[11.5px] text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-100" data-testid="client-banner">
                  <Eye className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> <b>{active.clientName ?? active.otherName} can read this conversation.</b> Keep clinical notes in the session record.
                </div>
              )}
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-surface-2/40 p-4">
                {active.messages.length === 0 && <p className="pt-8 text-center text-[12.5px] text-text-3">{isClient ? "Your practice will message you here." : `Start the conversation with ${active.otherName.split(" ")[0]}.`}</p>}
                {active.messages.map((m, i) => {
                  const showDay = i === 0 || dayOf(m.at) !== dayOf(active.messages[i - 1]!.at);
                  return (
                    <div key={m.id} id={`msg-${m.id}`} className={cn("rounded-2xl transition-colors", flashId === m.id && "bg-accent/10")}>
                      {showDay && <div className="my-2 text-center text-[11px] text-text-3">{dayOf(m.at)}</div>}
                      <div className={cn("group relative flex items-end gap-1.5", m.from === "me" ? "justify-end" : "justify-start", !m.deleted && m.reactions && m.reactions.length > 0 && "mb-3.5")}>
                        {editingId === m.id ? (
                          <div className="flex w-full max-w-[80%] items-end justify-end gap-1.5">
                            <textarea
                              autoFocus
                              rows={1}
                              ref={(el) => autoGrow(el)}
                              onInput={(e) => autoGrow(e.currentTarget)}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditingId(null); }}
                              className="max-h-44 min-h-[44px] flex-1 resize-none rounded-2xl border border-accent/50 bg-surface px-3 py-2.5 text-[13.5px] leading-[1.45] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                            />
                            <button type="button" onClick={saveEdit} aria-label="Save" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"><Check className="size-4" aria-hidden /></button>
                            <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-3 hover:bg-surface-hover"><X className="size-4" aria-hidden /></button>
                          </div>
                        ) : (
                          <>
                            {/* Hover actions - mine: react · reply · edit · delete; theirs: react · reply (after the bubble). */}
                            {!m.deleted && !m.id.startsWith("local_") && (
                              <div className={cn("relative mb-1 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100", m.from === "them" && "order-2")}>
                                <button type="button" onClick={() => setReactFor(reactFor === m.id ? null : m.id)} aria-label="React" title="React" className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-text"><SmilePlus className="size-3.5" aria-hidden /></button>
                                <button type="button" onClick={() => { setReplyTo({ id: m.id, senderName: m.from === "me" ? "You" : (m.senderName ?? active.otherName), text: stripMentionTokens(m.text) || (m.attachment ? `📎 ${m.attachment.name}` : "") }); composerRef.current?.focus(); }} aria-label="Reply" title="Reply" className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-text"><CornerUpLeft className="size-3.5" aria-hidden /></button>
                                {m.from === "me" && (
                                  <>
                                    <button type="button" onClick={() => { setEditingId(m.id); setEditDraft(stripMentionTokens(m.text)); }} aria-label="Edit message" className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-text"><Pencil className="size-3.5" aria-hidden /></button>
                                    <button type="button" onClick={() => doDelete(m.id)} aria-label="Delete message" className="inline-flex size-7 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-danger"><Trash2 className="size-3.5" aria-hidden /></button>
                                  </>
                                )}
                                {reactFor === m.id && (
                                  <div className={cn("absolute bottom-full z-20 mb-1 flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-[var(--shadow-card)]", m.from === "me" ? "right-0" : "left-0")} role="group" aria-label="Quick reactions">
                                    {QUICK_REACTIONS.map((e) => (
                                      <button key={e} type="button" onClick={() => react(m.id, e)} aria-label={`React ${e}`} className="flex size-8 items-center justify-center rounded-full text-[18px] leading-none transition-transform hover:scale-125 hover:bg-surface-hover">{e}</button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <div data-testid="bubble" className={cn("relative max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed", m.deleted ? "bg-surface-2 italic text-text-3" : m.from === "me" ? "bg-accent text-accent-ink" : "bg-surface text-text shadow-sm", m.from === "them" && "order-1")}>
                              {m.from === "them" && m.senderName && !m.deleted && <div className="mb-0.5 text-[11px] font-semibold text-accent">{m.senderName}</div>}
                              {!m.deleted && m.replyTo && (
                                <button type="button" onClick={() => jumpTo(m.replyTo!.id)} className={cn("mb-1.5 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left", m.from === "me" ? "border-accent-ink/60 bg-white/15 hover:bg-white/25" : "border-accent bg-surface-2 hover:bg-surface-hover")}>
                                  <span className={cn("block text-[11px] font-semibold", m.from === "me" ? "text-accent-ink/90" : "text-accent")}>{m.replyTo.senderName}</span>
                                  <span className={cn("block truncate text-[12px]", m.from === "me" ? "text-accent-ink/80" : "text-text-2")}>{stripMentionTokens(m.replyTo.text) || "Message"}</span>
                                </button>
                              )}
                              {!m.deleted && m.attachment && (
                                <button
                                  type="button"
                                  onClick={() => openAttachment(m.id)}
                                  className={cn("mb-1 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors", m.from === "me" ? "bg-white/15 hover:bg-white/25" : "bg-surface-2 hover:bg-surface-hover")}
                                >
                                  <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", m.from === "me" ? "bg-white/20" : "bg-surface text-text-3")}>
                                    <FileText className="size-4" strokeWidth={1.9} aria-hidden />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12.5px] font-medium">{m.attachment.name}</span>
                                    <span className={cn("block text-[10.5px]", m.from === "me" ? "text-accent-ink/70" : "text-text-3")}>{sizeLabel(m.attachment.bytes)}</span>
                                  </span>
                                  <Download className={cn("size-4 shrink-0", m.from === "me" ? "text-accent-ink/80" : "text-text-3")} aria-hidden />
                                </button>
                              )}
                              {m.deleted ? "This message was deleted" : <span className="whitespace-pre-wrap break-words"><MessageBody text={m.text} myUserId={myUserId} mine={m.from === "me"} /></span>}
                              {!m.deleted && (
                                <div className={cn("mt-1 flex items-center gap-1 text-[10px]", m.from === "me" ? "text-accent-ink/70" : "text-text-3")}>
                                  {timeOf(m.at)}{m.edited && <span>· edited</span>}
                                </div>
                              )}
                              {!m.deleted && m.reactions && m.reactions.length > 0 && (
                                <div className={cn("absolute -bottom-3 flex flex-wrap gap-1", m.from === "me" ? "right-2" : "left-2")}>
                                  {m.reactions.map((r) => {
                                    const mine = r.userIds.includes(myUserId);
                                    return (
                                      <button key={r.emoji} type="button" onClick={() => react(m.id, r.emoji)} title={r.userIds.map(nameOf).join(", ")} aria-label={`${r.emoji} ${r.userIds.length}`} className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-[12px] leading-none shadow-sm transition-colors", mine ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}>
                                        <span>{r.emoji}</span><span className="text-[11px] font-semibold tabular-nums">{r.userIds.length}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {((typingNames[active.id]?.length ?? 0) > 0 || typing?.threadId === active.id) && (
                  <div className="flex items-end gap-1.5" data-testid="typing-bubble" aria-live="polite">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-surface px-3.5 py-2 text-[12px] text-text-3 shadow-sm">
                      <span className="inline-flex items-center gap-0.5" aria-hidden>
                        <span className="size-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:0ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:150ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:300ms]" />
                      </span>
                      {typingLabel(active.kind, typing?.threadId === active.id ? [typing.name] : typingNames[active.id] ?? [])}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="relative border-t border-border p-3">
                {support && support.threadId === active.id && (
                  <div className="mb-2.5 rounded-card border border-accent/30 bg-accent-soft/30 p-3" data-testid="crisis-support-card" role="status" aria-live="polite">
                    <div className="flex items-start gap-2.5">
                      <HeartHandshake className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-[650] text-text">Your message was sent. If things feel heavy right now, you don&apos;t have to wait.</div>
                        <p className="mt-0.5 text-[12px] text-text-2">These lines are free, open any time, and only you can see this note.</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {support.lines.map((l) => (
                            <a key={l.name} href={l.href} className="inline-flex items-center gap-1.5 rounded-control border border-accent/30 bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-text hover:bg-surface-hover">
                              <Phone className="size-3.5 text-accent" strokeWidth={2.2} aria-hidden /> {l.name} <span className="font-semibold">{l.phone}</span> <span className="text-[11px] font-normal text-text-3">· {l.note}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={() => setSupport(null)} aria-label="Close" className="inline-flex size-6 shrink-0 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-text"><X className="size-3.5" aria-hidden /></button>
                    </div>
                  </div>
                )}
                <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-text-3">
                  {isClient ? (
                    <><ShieldCheck className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> Private between you and your care team. Files are shared through Documents.</>
                  ) : active.kind === "client" ? (
                    <><Eye className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> Visible to the client. Reminders + booking notices still go out by SMS/WhatsApp.</>
                  ) : (
                    <><Lock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /> Internal  private to your team. Client reminders go out by SMS/WhatsApp, not here.</>
                  )}
                </div>
                {replyTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-control border-l-2 border-accent bg-surface-2 px-2.5 py-1.5" data-testid="reply-bar">
                    <CornerUpLeft className="size-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold text-accent">Replying to {replyTo.senderName}</span>
                      <span className="block truncate text-[12px] text-text-2">{stripMentionTokens(replyTo.text) || "Message"}</span>
                    </span>
                    <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="inline-flex size-6 shrink-0 items-center justify-center rounded-control text-text-3 hover:bg-surface-hover hover:text-text"><X className="size-3.5" aria-hidden /></button>
                  </div>
                )}
                {/* Batch 4n - @mention completion: people in this conversation, arrow keys + Enter / Tab */}
                {mention && mentionOptions.length > 0 && (
                  <div className="absolute bottom-full left-3 right-3 z-30 mb-1 sm:right-auto sm:w-72" data-testid="mention-menu" role="listbox" aria-label="Mention someone">
                    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-lg">
                      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5 text-[11px] text-text-3"><AtSign className="size-3" strokeWidth={2.2} aria-hidden /> Mention someone in this conversation</div>
                      <ul className="max-h-56 overflow-y-auto py-1">
                        {mentionOptions.map((m, i) => (
                          <li key={m.userId}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={i === mentionIdx}
                              onMouseDown={(e) => { e.preventDefault(); pickMention(m); }}
                              onMouseEnter={() => setMentionIdx(i)}
                              className={cn("flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left", i === mentionIdx ? "bg-accent-soft/60" : "hover:bg-surface-hover")}
                            >
                              <Avatar name={m.name} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-text">{m.name}</span>
                                <span className="block truncate text-[11px] text-text-3">{roleLabel((active.members?.find((x) => x.userId === m.userId)?.role ?? "counsellor") as TeamRole)}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {emojiOpen && (
                  <div className="absolute bottom-full left-3 z-30 mb-1">
                    <EmojiPicker onPick={(e) => { insertEmoji(e); }} onClose={() => setEmojiOpen(false)} />
                  </div>
                )}
                <div className="flex items-end gap-1.5 sm:gap-2">
                  {!isClient && (
                    <>
                      <input ref={attachInput} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAndSend(f); e.target.value = ""; }} aria-hidden />
                      <button
                        type="button"
                        onClick={() => attachInput.current?.click()}
                        disabled={uploading > 0}
                        aria-label="Attach a file"
                        title="Attach a file"
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
                      >
                        <Paperclip className={cn("size-[18px]", uploading > 0 && "animate-pulse")} strokeWidth={2} aria-hidden />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    aria-label="Add emoji"
                    title="Emoji"
                    aria-expanded={emojiOpen}
                    className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-control transition-colors hover:bg-surface-hover hover:text-text", emojiOpen ? "bg-accent-soft text-accent" : "text-text-2")}
                  >
                    <SmilePlus className="size-[18px]" strokeWidth={2} aria-hidden />
                  </button>
                  <textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); emitTyping(active.id); updateMention(e.target); }}
                    onKeyDown={onComposerKeyDown}
                    onKeyUp={(e) => { if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") updateMention(e.currentTarget); }}
                    onClick={(e) => updateMention(e.currentTarget)}
                    onBlur={() => setTimeout(() => setMention(null), 150)}
                    placeholder={uploading > 0 ? "Uploading…" : isClient ? "Message your practice…" : `Message ${active.otherName.split(" ")[0]}…`}
                    rows={1}
                    onInput={(e) => autoGrow(e.currentTarget)}
                    className="max-h-44 min-h-[44px] flex-1 resize-none rounded-control border border-border bg-surface px-3 py-2.5 text-[14px] leading-[1.45] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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

      {active && !active.id.startsWith("local_") && (
        <ThreadInfo
          key={active.id}
          thread={active}
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          myUserId={myUserId}
          myRole={myRole}
          mode={mode}
          teammates={teammates}
          online={online}
          onRenamed={(title) => setThreads((prev) => prev.map((t) => (t.id === active.id ? { ...t, otherName: title } : t)))}
          onMembers={(members) => setThreads((prev) => prev.map((t) => (t.id === active.id ? { ...t, members, memberCount: members.length } : t)))}
          onLeft={() => { setInfoOpen(false); setThreads((prev) => prev.filter((t) => t.id !== active.id)); setActiveId(null); setMobileThread(false); }}
          onOpenAttachment={(id) => void openAttachment(id)}
        />
      )}

      <Dialog
        open={newOpen}
        onClose={() => { setNewOpen(false); setNewQuery(""); }}
        title="New message"
        description={newTab === "clients" ? "Clients you may message - they read and reply in their portal." : "Search your team and tap someone to start."}
      >
        {!isClient && (
          <div className="mb-2 inline-flex rounded-control border border-border bg-surface p-0.5" role="tablist" aria-label="Who to message">
            {(["team", "clients"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={newTab === k} onClick={() => { setNewTab(k); setNewQuery(""); }} className={cn("rounded-[calc(var(--radius-control)-2px)] px-3 py-1 text-[12.5px] font-medium transition-colors", newTab === k ? "bg-accent text-accent-ink" : "text-text-2 hover:text-text")}>
                {k === "team" ? "Team" : "Clients"}
              </button>
            ))}
          </div>
        )}
        <MemberSearch query={newQuery} onQuery={setNewQuery} placeholder={newTab === "clients" ? "Search clients…" : "Search colleagues…"} />
        {newTab === "clients" ? (
          <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto" data-testid="clients-door">
            {clientList === null ? (
              <p className="py-8 text-center text-[12.5px] text-text-3">Loading clients…</p>
            ) : clientList.filter(matchName(newQuery)).length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-text-3">{clientList.length === 0 ? (myRole === "counsellor" ? "No clients on your caseload yet." : "No clients yet.") : "No clients match."}</p>
            ) : (
              clientList.filter(matchName(newQuery)).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void startWithClient(c)}
                  disabled={clientBusy !== null}
                  className="flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
                >
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-text">
                      {c.name}
                      <span className="shrink-0 rounded-full bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">Client</span>
                    </div>
                    <div className="truncate text-[11px] text-text-3">
                      {c.threadId ? "Conversation open" : c.hasLogin ? "Has a portal login" : "No portal login yet - your first message carries the activation link"}
                      {c.counsellorName ? ` · ${c.counsellorName.split(" ")[0]}` : ""}
                    </div>
                  </div>
                  {clientBusy === c.id && <span className="text-[11px] text-text-3">Opening…</span>}
                </button>
              ))
            )}
          </div>
        ) : (
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
                  <div className="text-[11px] text-text-3">{online.has(m.userId) ? <span className="text-emerald-600">Active now</span> : roleLabel(m.role)}</div>
                </div>
              </button>
            ))
          )}
        </div>
        )}
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
          <Input placeholder="Group name  e.g. Intake team" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} />
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
                    <div className="text-[11px] text-text-3">{roleLabel(m.role)}</div>
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
    </FullPage>
  );
}

function ThreadAvatar({ thread, size, online }: { thread: TeamThread; size: "sm" | "md"; online?: boolean }) {
  const inner =
    thread.kind === "group" ? (
      <span className={cn(size === "md" ? "size-9" : "size-8", "inline-flex items-center justify-center rounded-full bg-accent-soft text-accent")}>
        <UsersRound className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
    ) : thread.kind === "client" ? (
      <span className="relative inline-flex">
        <Avatar name={thread.otherName} size={size} />
        <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-3.5 items-center justify-center rounded-full border-2 border-surface bg-sky-500 text-white" aria-hidden><ShieldCheck className="size-2" strokeWidth={3} /></span>
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

/** Batch 4g - add/remove one user's emoji in a message's grouped reactions. */
function applyReaction(
  reactions: { emoji: string; userIds: string[] }[] | undefined,
  emoji: string,
  userId: string,
  added: boolean,
): { emoji: string; userIds: string[] }[] | undefined {
  const list = (reactions ?? []).map((r) => ({ emoji: r.emoji, userIds: [...r.userIds] }));
  const hit = list.find((r) => r.emoji === emoji);
  if (added) {
    if (hit) { if (!hit.userIds.includes(userId)) hit.userIds.push(userId); }
    else list.push({ emoji, userIds: [userId] });
  } else if (hit) {
    hit.userIds = hit.userIds.filter((u) => u !== userId);
  }
  const out = list.filter((r) => r.userIds.length > 0);
  return out.length > 0 ? out : undefined;
}

/** Batch 4m - "Nomsa is typing…" / "Nomsa and Thabo are typing…" / "typing…" for a DM. */
function typingLabel(kind: string, names: string[]): string {
  if (kind === "direct") return "typing…";
  const first = names.map((n) => n.split(" ")[0]);
  if (first.length === 0) return "typing…";
  if (first.length === 1) return `${first[0]} is typing…`;
  if (first.length === 2) return `${first[0]} and ${first[1]} are typing…`;
  return `${first[0]}, ${first[1]} and ${first.length - 2} more are typing…`;
}

/** Batch 4n - a message body with @mentions as chips; the one that names me glows. */
function MessageBody({ text, myUserId, mine }: { text: string; myUserId: string; mine: boolean }) {
  const segs = splitMentions(text);
  if (segs.length === 1 && segs[0]!.kind === "text") return <>{text}</>;
  return (
    <>
      {segs.map((seg, i) => seg.kind === "text"
        ? <span key={i}>{seg.text}</span>
        : (
          <span
            key={i}
            data-testid="mention-chip"
            data-me={seg.userId === myUserId ? "true" : undefined}
            className={cn(
              "rounded-md px-1 py-px font-[620]",
              mine ? "bg-white/20 text-accent-ink" : seg.userId === myUserId ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent",
            )}
          >@{seg.name.split(" ")[0]}</span>
        ))}
    </>
  );
}
