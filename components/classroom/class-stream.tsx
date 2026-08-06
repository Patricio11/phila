"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GraduationCap, Pencil, Send, Trash2, Users, X } from "lucide-react";
import type { ClassSessionView, ClassView } from "@/db/queries/classrooms";
import { ClassSessions } from "@/components/classroom/class-sessions";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { postClassMessage, editClassPost, deleteClassPost } from "@/app/app/supervision/actions";
import { cn } from "@/lib/utils";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * The classroom stream (batch 2) — announcements + replies for a supervision
 * class, Classroom-style. No clinical content here; notes stay in sign-off.
 */
export function ClassStream({ cls, sessions = [], canManage = false, nowISO, showCode = false, meUserId }: { cls: ClassView; sessions?: ClassSessionView[]; canManage?: boolean; nowISO?: string; showCode?: boolean; meUserId?: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  // Fix what you wrote (batch 2d) — edit/delete your OWN posts.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const saveEdit = () =>
    start(async () => {
      if (!editingId) return;
      const res = await editClassPost({ postId: editingId, body: editBody });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setEditingId(null);
      router.refresh();
    });

  const removePost = (postId: string) =>
    start(async () => {
      const res = await deleteClassPost({ postId });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Post deleted" });
      router.refresh();
    });

  const post = () =>
    start(async () => {
      const res = await postClassMessage({ classId: cls.id, body });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setBody("");
      router.refresh();
    });

  return (
    <Card className="overflow-hidden">
      {/* Banner — the class identity */}
      <div className="flex items-start justify-between gap-3 bg-accent px-5 py-4 text-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[15.5px] font-[680] tracking-[-0.01em]">
            <GraduationCap className="size-[18px] shrink-0" strokeWidth={2} aria-hidden /> {cls.name}
          </div>
          <div className="mt-0.5 text-[12.5px] opacity-90">
            {cls.supervisorName} · {cls.members.length} member{cls.members.length === 1 ? "" : "s"}
            {cls.description ? ` · ${cls.description}` : ""}
          </div>
        </div>
        {showCode && (
          <span className="shrink-0 rounded-chip bg-white/15 px-2.5 py-1 text-[12px] font-semibold tabular-nums">{cls.code}</span>
        )}
      </div>

      <div className="space-y-4 p-4">
        {/* Members strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Users className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />
          {cls.members.slice(0, 8).map((m) => (
            <span key={m.counsellorId} className="inline-flex items-center gap-1.5 rounded-chip bg-surface-2 px-2 py-0.5 text-[11.5px] text-text-2">
              <Avatar name={m.name} size="sm" /> {m.name.split(" ")[0]}
            </span>
          ))}
          {cls.members.length > 8 && <span className="text-[11.5px] text-text-3">+{cls.members.length - 8} more</span>}
        </div>

        {/* Live sessions + register (batch 2b) */}
        {nowISO && (
          <ClassSessions
            classId={cls.id}
            className={cls.name}
            members={cls.members}
            sessions={sessions}
            canManage={canManage}
            nowISO={nowISO}
          />
        )}

        {/* Composer */}
        <div className="rounded-control border border-border bg-surface p-2.5">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share something with your class — an announcement, reading, or question…"
            className="min-h-[64px] border-0 p-1 focus-visible:ring-0"
            aria-label={`Post to ${cls.name}`}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={post} loading={pending} disabled={!body.trim()}>
              <Send className="size-3.5" strokeWidth={2} aria-hidden /> Post
            </Button>
          </div>
        </div>

        {/* Stream */}
        {cls.posts.length === 0 ? (
          <p className="py-2 text-center text-[12.5px] text-text-3">This is where you talk to your class — the first post starts the stream.</p>
        ) : (
          <ul className="space-y-3">
            {cls.posts.map((p) => (
              <li key={p.id} className="group flex gap-2.5">
                <Avatar name={p.authorName} size="sm" />
                <div className={cn("min-w-0 flex-1 rounded-card border p-3", p.isSupervisor ? "border-accent/25 bg-accent-soft/25" : "border-border bg-surface")}>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-semibold text-text">{p.authorName}</span>
                    {p.isSupervisor && <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">Supervisor</span>}
                    <span className="ml-auto text-text-3">{when(p.createdAt)}</span>
                    {meUserId === p.authorUserId && editingId !== p.id && (
                      <span className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button type="button" onClick={() => { setEditingId(p.id); setEditBody(p.body); }} aria-label="Edit post" className="rounded p-1 text-text-3 hover:text-text">
                          <Pencil className="size-3.5" strokeWidth={2} aria-hidden />
                        </button>
                        <button type="button" onClick={() => removePost(p.id)} disabled={pending} aria-label="Delete post" className="rounded p-1 text-text-3 hover:text-danger">
                          <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
                        </button>
                      </span>
                    )}
                  </div>
                  {editingId === p.id ? (
                    <div className="mt-1.5 space-y-2">
                      <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[64px]" aria-label="Edit your post" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} loading={pending} disabled={!editBody.trim()}>
                          <Check className="size-3.5" strokeWidth={2.2} aria-hidden /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={pending}>
                          <X className="size-3.5" strokeWidth={2} aria-hidden /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-text-2">{p.body}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
