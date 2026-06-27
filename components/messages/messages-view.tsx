"use client";

import { useState } from "react";
import { ArrowLeft, Info, Send } from "lucide-react";
import type { Conversation } from "@/lib/data-provider";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function dayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

export function MessagesView({ conversations }: { conversations: Conversation[] }) {
  const [threads, setThreads] = useState(conversations);
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.clientId ?? null);
  const [draft, setDraft] = useState("");
  const [mobileThread, setMobileThread] = useState(false);

  const active = threads.find((t) => t.clientId === activeId) ?? null;

  const openThread = (id: string) => {
    setActiveId(id);
    setMobileThread(true);
    setThreads((prev) => prev.map((t) => (t.clientId === id ? { ...t, unread: 0 } : t)));
  };

  const send = () => {
    if (!draft.trim() || !active) return;
    const msg = { id: `local_${Date.now()}`, from: "counsellor" as const, text: draft.trim(), at: new Date().toISOString() };
    setThreads((prev) => prev.map((t) => (t.clientId === active.clientId ? { ...t, messages: [...t.messages, msg], lastAt: msg.at } : t)));
    setDraft("");
  };

  if (threads.length === 0) {
    return <EmptyState icon={MessagesSquare} title="No conversations yet" body="Messages with your clients will appear here." />;
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      <div className="grid h-[calc(100dvh-220px)] min-h-[420px] grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Thread list */}
        <ul className={cn("divide-y divide-border overflow-y-auto border-r border-border", mobileThread && "hidden lg:block")}>
          {threads.map((t) => (
            <li key={t.clientId}>
              <button
                type="button"
                onClick={() => openThread(t.clientId)}
                className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover", activeId === t.clientId && "bg-accent-soft/40")}
              >
                <Avatar name={t.clientName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-medium text-text">{t.clientName}</span>
                    <span className="shrink-0 text-[11px] text-text-3">{t.lastAt ? timeOf(t.lastAt) : ""}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-text-2">{t.messages[t.messages.length - 1]?.text}</span>
                    {t.unread > 0 && <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink">{t.unread}</span>}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Thread */}
        <div className={cn("flex flex-col", !mobileThread && "hidden lg:flex")}>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <button type="button" onClick={() => setMobileThread(false)} className="lg:hidden" aria-label="Back to conversations">
                  <ArrowLeft className="size-5 text-text-2" aria-hidden />
                </button>
                <Avatar name={active.clientName} size="sm" />
                <span className="text-[14px] font-[600] text-text">{active.clientName}</span>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto bg-surface-2/40 p-4">
                {active.messages.map((m, i) => {
                  const showDay = i === 0 || dayOf(m.at) !== dayOf(active.messages[i - 1]!.at);
                  return (
                    <div key={m.id}>
                      {showDay && <div className="my-2 text-center text-[11px] text-text-3">{dayOf(m.at)}</div>}
                      <div className={cn("flex", m.from === "counsellor" ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed", m.from === "counsellor" ? "bg-accent text-accent-ink" : "bg-surface text-text shadow-sm")}>
                          {m.text}
                          <div className={cn("mt-1 text-[10px]", m.from === "counsellor" ? "text-accent-ink/70" : "text-text-3")}>{timeOf(m.at)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <div className="border-t border-border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-text-3">
                  <Info className="size-3.5" strokeWidth={2} aria-hidden /> WhatsApp delivery turns on once your org configures messaging — drafts are kept until then.
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`Message ${active.clientName.split(" ")[0]}…`}
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
    </div>
  );
}
