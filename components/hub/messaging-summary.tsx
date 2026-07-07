import Link from "next/link";
import { Bell, Check, MessageCircle, Minus, Phone, Mail } from "lucide-react";
import type { MessagingSettings } from "@/db/queries/messaging";
import { cn } from "@/lib/utils";

/**
 * Messaging summary (W6.1) — promotes the once-buried notifications link-out to a
 * top-level Settings tab. Shows the channel enablement + credit balances at a glance,
 * with a clear route into the full manager (channels, credits, templates, quiet hours).
 */
export function MessagingSummary({ settings, credits, quietHours }: { settings: MessagingSettings; credits: { sms: number; email: number }; quietHours: string | null }) {
  const channels = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, on: settings.whatsappEnabled },
    { key: "sms", label: "SMS", icon: Phone, on: settings.smsEnabled },
    { key: "email", label: "Email", icon: Mail, on: settings.emailEnabled },
  ] as const;

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-text-2">Booking, reminder, and follow-up messages on WhatsApp, SMS, and email  routed to each client&apos;s preferred channel. Connect your WhatsApp number, top up SMS/email credits, and edit the wording.</p>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {channels.map((c) => (
          <div key={c.key} className="flex items-center justify-between rounded-control border border-border bg-surface-2/40 px-3 py-2.5">
            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text">
              <c.icon className="size-4 text-text-3" strokeWidth={2} aria-hidden /> {c.label}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[11px] font-semibold", c.on ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>
              {c.on ? <Check className="size-3" strokeWidth={2.6} aria-hidden /> : <Minus className="size-3" strokeWidth={2.6} aria-hidden />}
              {c.on ? "On" : "Off"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-text-2">
        <span><span className="font-semibold tabular-nums text-text">{credits.sms.toLocaleString("en-ZA")}</span> SMS credits</span>
        <span><span className="font-semibold tabular-nums text-text">{credits.email.toLocaleString("en-ZA")}</span> email credits</span>
        {quietHours && <span>Quiet hours <span className="font-medium text-text">{quietHours}</span></span>}
      </div>

      <div className="flex justify-start pt-0.5">
        <Link href="/hub/settings/notifications" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-surface px-3.5 text-[13px] font-medium text-text transition-colors hover:bg-surface-hover">
          <Bell className="size-4" strokeWidth={2} aria-hidden /> Manage messaging
        </Link>
      </div>
    </div>
  );
}
