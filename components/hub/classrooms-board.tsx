"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, DoorOpen, GraduationCap, Pencil, Plus, UserMinus, UserPlus } from "lucide-react";
import type { ClassSessionView, ClassSummary, ClassView } from "@/db/queries/classrooms";
import { ClassStream } from "@/components/classroom/class-stream";
import { Dialog } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { SearchSelect } from "@/components/ui/search-select";
import { Input, Label, FieldError, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createClassroom, setClassroomMember, updateClassroom } from "@/app/hub/supervision/actions";

function ago(iso: string | null): string {
  if (!iso) return "no posts yet";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `active ${Math.max(1, mins)} min ago`;
  if (mins < 1_440) return `active ${Math.round(mins / 60)}h ago`;
  return `active ${Math.round(mins / 1_440)}d ago`;
}

/**
 * Hub - create + manage supervision classrooms (batch 2), and OPEN them
 * (batch 2e): the org steps into the same stream the class sees - every post,
 * every session, the join link - can post as the practice, schedule (incl. a
 * weekly run) and mark registers. The org is never locked out of its rooms.
 */
export function ClassroomsBoard({ classes, streams = [], sessions = [], supervisors, counsellors, nowISO, meUserId }: {
  classes: ClassSummary[];
  streams?: ClassView[];
  sessions?: ClassSessionView[];
  supervisors: { id: string; name: string }[];
  counsellors: { id: string; name: string }[];
  nowISO?: string;
  meUserId?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [name, setName] = useState("");
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);
  // Edit (batch 2d) - fix a typo, rewrite the description, or hand the class over.
  const [editing, setEditing] = useState<ClassSummary | null>(null);
  const [eName, setEName] = useState("");
  const [eSupervisorId, setESupervisorId] = useState<string | null>(null);
  const [eDescription, setEDescription] = useState("");

  const openEdit = (c: ClassSummary) => {
    setEditing(c);
    setEName(c.name);
    setESupervisorId(c.supervisorId);
    setEDescription(c.description ?? "");
  };

  const saveEdit = () => {
    if (!editing) return;
    if (eName.trim().length < 2 || !eSupervisorId) return toast({ tone: "error", title: "Give the classroom a name and a supervisor." });
    start(async () => {
      const res = await updateClassroom({ classId: editing.id, name: eName.trim(), supervisorId: eSupervisorId!, description: eDescription.trim() || undefined });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Classroom updated" });
      setEditing(null);
      router.refresh();
    });
  };

  const errors = { name: name.trim().length < 2 ? "Give the classroom a name." : "", supervisor: !supervisorId ? "Pick the supervisor." : "" };

  const create = () => {
    setAttempted(true);
    if (errors.name || errors.supervisor) return;
    start(async () => {
      const res = await createClassroom({ name: name.trim(), supervisorId: supervisorId!, description: description.trim() || undefined });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Classroom created", description: `${res.members} supervisee${res.members === 1 ? "" : "s"} joined automatically · code ${res.code}` });
      setOpen(false);
      setName(""); setSupervisorId(null); setDescription(""); setAttempted(false);
      router.refresh();
    });
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1500); } catch { /* blocked */ }
  };

  const toggleMember = (classId: string, counsellorId: string, present: boolean) =>
    start(async () => {
      const res = await setClassroomMember({ classId, counsellorId, present });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      router.refresh();
    });

  const managed = classes.find((c) => c.id === manageId) ?? null;

  // Open classroom (batch 2e) - the org inside the class, same view the class has.
  const [openClassId, setOpenClassId] = useState<string | null>(null);
  const openedStream = streams.find((s) => s.id === openClassId) ?? null;

  if (openedStream) {
    return (
      <div className="space-y-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setOpenClassId(null)}>
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> All classrooms
          </Button>
        </div>
        <ClassStream
          cls={openedStream}
          sessions={sessions.filter((s) => s.classId === openedStream.id)}
          canManage
          nowISO={nowISO}
          showCode
          meUserId={meUserId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={2.2} aria-hidden /> Create classroom
        </Button>
      </div>

      {classes.length === 0 ? (
        <Card className="p-2">
          <EmptyState icon={GraduationCap} title="No classrooms yet" body="Create one per supervisor - their supervisees join automatically and share a stream." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="bg-accent px-5 py-4 text-white">
                <div className="flex items-center gap-2 text-[15px] font-[680]">
                  <GraduationCap className="size-[18px]" strokeWidth={2} aria-hidden /> {c.name}
                </div>
                <div className="mt-0.5 text-[12.5px] opacity-90">{c.supervisorName} · {c.postCount} post{c.postCount === 1 ? "" : "s"} · {ago(c.lastPostAt)}</div>
              </div>
              <div className="space-y-3 p-4">
                {c.description && <p className="text-[12.5px] leading-relaxed text-text-2">{c.description}</p>}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Class code</span>
                  <button type="button" onClick={() => copyCode(c.code)} className="inline-flex items-center gap-1.5 rounded-chip bg-surface-2 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-text hover:bg-surface-hover">
                    {c.code} {copied === c.code ? <Check className="size-3.5 text-accent" strokeWidth={2.4} aria-hidden /> : <Copy className="size-3.5 text-text-3" strokeWidth={2} aria-hidden />}
                  </button>
                </div>
                <div>
                  <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Members · {c.members.length}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.members.map((m) => (
                      <span key={m.counsellorId} className="inline-flex items-center gap-1.5 rounded-chip bg-surface-2 px-2 py-0.5 text-[11.5px] text-text-2">
                        <Avatar name={m.name} size="sm" /> {m.name.split(" ")[0]}
                      </span>
                    ))}
                    {c.members.length === 0 && <span className="text-[12px] text-text-3">Nobody yet - add members below.</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setOpenClassId(c.id)}>
                    <DoorOpen className="size-3.5" strokeWidth={2} aria-hidden /> Open classroom
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setManageId(c.id)}>
                    <UserPlus className="size-3.5" strokeWidth={2} aria-hidden /> Manage members
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="size-3.5" strokeWidth={2} aria-hidden /> Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Create a classroom"
        description="One class per supervisor - their supervisees join automatically and can be adjusted after."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={create} loading={pending}>Create classroom</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trainee supervision - Nomsa's group" invalid={Boolean(attempted && errors.name)} />
            {attempted && errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <SearchSelect
              avatars
              value={supervisorId}
              onChange={setSupervisorId}
              placeholder="Choose a supervisor"
              searchPlaceholder="Search supervisors…"
              ariaLabel="Classroom supervisor"
              options={supervisors.map((s) => ({ value: s.id, label: s.name, hint: "Supervisor" }))}
              invalid={Boolean(attempted && errors.supervisor)}
            />
            {attempted && errors.supervisor ? <FieldError>{errors.supervisor}</FieldError> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this class covers - case discussions, readings, HPCSA CPD…" className="min-h-[64px]" />
          </div>
        </div>
      </Dialog>

      {/* Edit classroom */}
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit classroom"
        description="Fix the name or description, or hand the class to another supervisor - the roster stays."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={pending}>Cancel</Button>
            <Button onClick={saveEdit} loading={pending}>Save changes</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={eName} onChange={(e) => setEName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <SearchSelect
              avatars
              value={eSupervisorId}
              onChange={setESupervisorId}
              placeholder="Choose a supervisor"
              searchPlaceholder="Search supervisors…"
              ariaLabel="Edit classroom supervisor"
              options={supervisors.map((s) => ({ value: s.id, label: s.name, hint: "Supervisor" }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} className="min-h-[64px]" />
          </div>
        </div>
      </Dialog>

      {/* Manage members */}
      <Dialog
        open={Boolean(managed)}
        onClose={() => setManageId(null)}
        title={managed ? `Members · ${managed.name}` : "Members"}
        description="Add any counsellor in the practice, or remove someone who's moved on."
        footer={<div className="flex justify-end"><Button variant="ghost" onClick={() => setManageId(null)}>Done</Button></div>}
      >
        {managed && (
          <ul className="space-y-1.5">
            {counsellors.filter((c) => c.id !== managed.supervisorId).map((c) => {
              const present = managed.members.some((m) => m.counsellorId === c.id);
              return (
                <li key={c.id} className="flex items-center gap-2.5 rounded-control border border-border p-2.5">
                  <Avatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{c.name}</span>
                  <Button
                    size="sm"
                    variant={present ? "ghost" : "mini-solid"}
                    onClick={() => toggleMember(managed.id, c.id, !present)}
                    disabled={pending}
                  >
                    {present ? <><UserMinus className="size-3.5" strokeWidth={2} aria-hidden /> Remove</> : <><UserPlus className="size-3.5" strokeWidth={2} aria-hidden /> Add</>}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </div>
  );
}
