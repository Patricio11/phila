"use client";

import { useState, useTransition } from "react";
import { Mail, MessageCircle, Send, Smartphone } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { inviteClientToPortal } from "@/app/hub/clients/actions";
import { cn } from "@/lib/utils";

type Channel = "whatsapp" | "sms" | "email";

export function InviteClientButton({
  clientId,
  clientName,
  phone,
  email,
  whatsappOn,
  smsOn,
}: {
  clientId: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  whatsappOn: boolean;
  smsOn: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const options: { key: Channel; label: string; detail: string; icon: typeof Mail; available: boolean; note?: string }[] = [
    { key: "whatsapp", label: "WhatsApp", detail: phone ?? "No number on file", icon: MessageCircle, available: Boolean(phone) && whatsappOn, note: phone && !whatsappOn ? "Connect WhatsApp in Settings" : undefined },
    { key: "sms", label: "SMS", detail: phone ?? "No number on file", icon: Smartphone, available: Boolean(phone) && smsOn, note: phone && !smsOn ? "Connect SMS in Settings" : undefined },
    { key: "email", label: "Email", detail: email ?? "No email on file", icon: Mail, available: Boolean(email) },
  ];
  const best = options.find((o) => o.available)?.key ?? "email";
  const [channel, setChannel] = useState<Channel>(best);

  const send = () => {
    start(async () => {
      const res = await inviteClientToPortal({ clientId, channel });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      const opt = options.find((o) => o.key === channel)!;
      toast({ tone: "success", title: `Invite sent to ${clientName.split(" ")[0]}`, description: `A set-password link will go out by ${opt.label} once messaging is connected.` });
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Send className="size-4" strokeWidth={2} aria-hidden /> Invite to portal
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Invite ${clientName.split(" ")[0]} to their portal`}
        description="They'll get a link to set a password and see their sessions, steps, and care plan."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={send} loading={pending} disabled={!options.find((o) => o.key === channel)?.available}>Send invite</Button>
          </div>
        }
      >
        <div className="space-y-2">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={!o.available}
              onClick={() => setChannel(o.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-control border p-3 text-left transition-colors disabled:opacity-55",
                channel === o.key && o.available ? "border-accent bg-accent-soft/40" : "border-border",
                o.available && "hover:bg-surface-hover",
              )}
            >
              <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", channel === o.key && o.available ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-3")}>
                <o.icon className="size-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-text">{o.label}</div>
                <div className="truncate text-[12px] text-text-3">{o.note ?? o.detail}</div>
              </div>
              {!o.available && <span className="shrink-0 text-[11px] text-text-3">Unavailable</span>}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
