"use client";

import { useState } from "react";
import { Bot, Check, MessageCircle, Smartphone, Video } from "lucide-react";
import type { OrgFeature } from "@/lib/domain/enums";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const FEATURES: { key: OrgFeature; label: string; description: string; icon: typeof Bot }[] = [
  { key: "ai", label: "AI note assistant", description: "Drafts notes for counsellors to edit and sign. Turning this on is also the POPIA cross-border consent gate.", icon: Bot },
  { key: "video", label: "In-app video", description: "Owned, in-region video rooms for online sessions. Off means counsellors paste their own meeting link.", icon: Video },
  { key: "whatsapp", label: "WhatsApp reminders", description: "Booking, reminder, and follow-up messages on WhatsApp.", icon: MessageCircle },
  { key: "sms", label: "SMS fallback", description: "SMS for clients without WhatsApp.", icon: Smartphone },
];

/**
 * Integration toggles  **dormant by default** (Dormant-by-Default Rule). "Off"
 * is a real off state. Turning one on doesn't pretend it's live; it says what's
 * still needed. In Part A this is local + honest; Phase 6/12/13/14 wire each rail.
 */
export function IntegrationToggles({ initial }: { initial: Record<OrgFeature, boolean> }) {
  const { toast } = useToast();
  const [state, setState] = useState(initial);

  const toggle = (key: OrgFeature, label: string) => {
    setState((prev) => {
      const on = !prev[key];
      toast(
        on
          ? { tone: "default", title: `${label} switched on`, description: "Finish configuring it before it goes live  nothing sends until then." }
          : { tone: "default", title: `${label} switched off`, description: "Off is a real off state  nothing leaves." },
      );
      return { ...prev, [key]: on };
    });
  };

  return (
    <div className="space-y-2.5">
      {FEATURES.map((f) => {
        const on = state[f.key];
        return (
          <div key={f.key} className="flex items-start gap-3 rounded-control border border-border bg-surface p-4">
            <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-chip", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
              <f.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-[600] text-text">{f.label}</span>
                <span className={cn("rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold", on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
                  {on ? "On" : "Off"}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{f.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${on ? "Turn off" : "Turn on"} ${f.label}`}
              onClick={() => toggle(f.key, f.label)}
              className={cn("mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-border-strong")}
            >
              <span className={cn("inline-flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-4" : "translate-x-0")}>
                {on ? <Check className="size-3 text-accent" strokeWidth={3} aria-hidden /> : null}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
