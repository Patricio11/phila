"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Send, Users } from "lucide-react";
import type { ClassView } from "@/db/queries/classrooms";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { postClassMessage } from "@/app/app/supervision/actions";
import { cn } from "@/lib/utils";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * The classroom stream (batch 2) — announcements + replies for a supervision
 * class, Classroom-style. No clinical content here; notes stay in sign-off.
 */
export function ClassStream({ cls, showCode = false }: { cls: ClassView; showCode?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

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
              <li key={p.id} className="flex gap-2.5">
                <Avatar name={p.authorName} size="sm" />
                <div className={cn("min-w-0 flex-1 rounded-card border p-3", p.isSupervisor ? "border-accent/25 bg-accent-soft/25" : "border-border bg-surface")}>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-semibold text-text">{p.authorName}</span>
                    {p.isSupervisor && <span className="rounded-chip bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">Supervisor</span>}
                    <span className="ml-auto text-text-3">{when(p.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-text-2">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
