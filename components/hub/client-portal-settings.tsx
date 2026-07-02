"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, UserPlus, type LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { saveClientPortalSettings } from "@/app/hub/settings/actions";
import { cn } from "@/lib/utils";

type PortalState = { inviteOnBooking: boolean; inviteOnCreate: boolean };
type Key = keyof PortalState;

const ROWS: { key: Key; label: string; icon: LucideIcon; description: string }[] = [
  { key: "inviteOnCreate", label: "Invite when adding a client", icon: UserPlus, description: "Turns the “Send portal invite” switch on by default in the Add-client form. Off means new clients are added quietly." },
  { key: "inviteOnBooking", label: "Invite when a client books online", icon: CalendarPlus, description: "Automatically sends a set-password link after someone books from your public page." },
];

/**
 * Client-portal onboarding policy  Dormant-by-Default. Both off means no client
 * ever gets a surprise set-password link; the org invites deliberately from a
 * client's profile. Orgs whose clients are comfortable online can opt in here.
 */
export function ClientPortalSettings({ initial }: { initial: PortalState }) {
  const { toast } = useToast();
  const [state, setState] = useState<PortalState>(initial);
  const [pending, start] = useTransition();

  const toggle = (key: Key, label: string) => {
    const prev = state;
    const next = { ...state, [key]: !state[key] };
    setState(next);
    start(async () => {
      const res = await saveClientPortalSettings(next);
      if (!res.ok) {
        setState(prev);
        return toast({ tone: "error", title: res.error });
      }
      toast({ tone: "default", title: `${label} ${next[key] ? "on" : "off"}`, description: next[key] ? "Clients will be invited automatically." : "No automatic invite — you invite from the client's profile." });
    });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[12.5px] leading-relaxed text-text-2">
        Some clients aren&apos;t online at all. By default nobody gets a set-password link — you invite deliberately from a client&apos;s profile. Turn these on only if your clients are comfortable using the portal.
      </p>
      {ROWS.map((r) => {
        const on = state[r.key];
        return (
          <div key={r.key} className="flex items-start gap-3 rounded-control border border-border bg-surface p-4">
            <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
              <r.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-[600] text-text">{r.label}</span>
                <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{on ? "On" : "Off"}</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{r.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              disabled={pending}
              aria-label={`${on ? "Turn off" : "Turn on"} ${r.label}`}
              onClick={() => toggle(r.key, r.label)}
              className={cn("mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60", on ? "bg-accent" : "bg-border-strong")}
            >
              <span className={cn("size-5 rounded-full bg-surface shadow-sm transition-transform", on && "translate-x-4")} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
