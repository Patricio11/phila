"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ShieldCheck, Clock, Send, UserX, MoreHorizontal } from "lucide-react";
import type { PlatformOperator } from "@/db/queries/platform";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { invitePlatformOperator, resendOperatorLink, revokeOperator } from "@/app/admin/users/actions";
import { cn } from "@/lib/utils";

export function OperatorsTable({ operators, selfUserId }: { operators: PlatformOperator[]; selfUserId: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border p-3.5">
          <div className="text-[13px] text-text-2">
            <span className="font-semibold text-text">{operators.length}</span> operator{operators.length === 1 ? "" : "s"}
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" strokeWidth={2} aria-hidden /> Invite operator
          </Button>
        </div>

        {operators.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-text-3">No operators yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {operators.map((op) => (
              <OperatorRow key={op.userId} op={op} isSelf={op.userId === selfUserId} />
            ))}
          </ul>
        )}
      </div>

      <InviteOperator open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}

function OperatorRow({ op, isSelf }: { op: PlatformOperator; isSelf: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const resend = () => start(async () => {
    const res = await resendOperatorLink({ userId: op.userId });
    setOpen(false);
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "success", title: "Setup link sent", description: `A fresh link is on its way to ${op.email}.` });
  });

  const revoke = () => start(async () => {
    const res = await revokeOperator({ userId: op.userId });
    setOpen(false);
    if (!res.ok) return toast({ tone: "error", title: res.error });
    toast({ tone: "default", title: `${op.name.split(" ")[0]}'s operator access revoked` });
    router.refresh();
  });

  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <Avatar name={op.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-text">
          {op.name}{isSelf && <span className="ml-1.5 text-[11px] font-normal text-text-3">· you</span>}
        </div>
        <div className="truncate text-[11.5px] text-text-3">{op.email}</div>
      </div>

      <div className="hidden w-40 shrink-0 sm:block">
        {op.pending ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-warn"><Clock className="size-3.5" strokeWidth={2} aria-hidden /> Invited · pending</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent"><ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden /> Active</span>
        )}
        <div className={cn("mt-0.5 text-[10.5px]", op.twoFactorEnabled ? "text-text-3" : "text-warn")}>
          {op.twoFactorEnabled ? "2FA on" : "2FA off"}
        </div>
      </div>

      <div className="relative shrink-0">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`Actions for ${op.name}`} className="grid size-8 place-items-center rounded-control text-text-3 transition-colors hover:bg-surface-2 hover:text-text">
          <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-control border border-border bg-surface p-1 shadow-[var(--shadow-card)]">
              <button type="button" onClick={resend} disabled={pending} className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[12.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50">
                <Send className="size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden /> {op.pending ? "Resend invite" : "Send reset link"}
              </button>
              {!isSelf && (
                <button type="button" onClick={revoke} disabled={pending} className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[12.5px] text-danger transition-colors hover:bg-danger-soft disabled:opacity-50">
                  <UserX className="size-4 shrink-0 text-danger" strokeWidth={2} aria-hidden /> Revoke access
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function InviteOperator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const errors = {
    name: name.trim().length < 2 ? "Enter their name." : "",
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "Enter a valid email." : "",
  };

  const submit = () => {
    setAttempted(true);
    if (errors.name || errors.email) return;
    start(async () => {
      const res = await invitePlatformOperator({ name: name.trim(), email });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Operator invited", description: `${name.split(" ")[0]} will get a link to set their password.` });
      onClose(); setName(""); setEmail(""); setAttempted(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a platform operator"
      description="They'll get a branded link to set their password and activate super-admin access. Encourage them to turn on 2FA."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={submit} loading={pending}>Send invite</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sizwe Ndlovu" invalid={Boolean(attempted && errors.name)} />
          {attempted && errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@philasa.com" invalid={Boolean(attempted && errors.email)} />
          {attempted && errors.email ? <FieldError>{errors.email}</FieldError> : null}
        </div>
      </div>
    </Dialog>
  );
}
