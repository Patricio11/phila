"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { saveClientPortalSettings } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * "Allow sign-up on booking"  the booking-page face of the org's client-portal
 * policy (also in Settings → Client portal). Off by default: a public booking just
 * books, with no account and no set-password link. On: the client is invited to
 * their portal after booking. Saved via the shared saveClientPortalSettings action,
 * preserving the create-time preference.
 */
export function BookingSignupToggle({ initial }: { initial: { inviteOnBooking: boolean; inviteOnCreate: boolean } }) {
  const { toast } = useToast();
  const [on, setOn] = useState(initial.inviteOnBooking);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await saveClientPortalSettings({ inviteOnBooking: next, inviteOnCreate: initial.inviteOnCreate });
      if (!res.ok) {
        setOn(!next);
        return toast({ tone: "error", title: res.error });
      }
      toast({
        tone: "default",
        title: next ? "Sign-up on booking on" : "Sign-up on booking off",
        description: next ? "Clients get a portal invite after they book." : "Clients just book  no account, no invite.",
      });
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-surface p-4">
      <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
        <UserPlus className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-[600] text-text">Allow sign-up on booking</span>
          <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{on ? "On" : "Off"}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">
          Off by default  many clients aren&apos;t online, so a booking just books. Turn on to invite each client to a
          private portal (to set a password, see sessions, and join online) after they book.
        </p>
      </div>
      <Switch checked={on} onChange={toggle} disabled={pending} label={`${on ? "Turn off" : "Turn on"} sign-up on booking`} className="mt-0.5" />
    </div>
  );
}
