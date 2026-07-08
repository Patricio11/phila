import Link from "next/link";
import { Bell, Check, MessageCircle, Minus, Phone, Mail, Zap } from "lucide-react";
import type { MessagingSettings, WhatsappConnectionView } from "@/db/queries/messaging";
import { cn } from "@/lib/utils";

/**
 * Messaging summary (W6.1) — promotes the once-buried notifications link-out to a
 * top-level Settings tab. WhatsApp leads as the primary channel (with its connection
 * status + the free 24h window); SMS/email are the metered backups. Links into the
 * full manager (channels, credits, templates, quiet hours).
 */
export function MessagingSummary({ settings, whatsapp, credits, quietHours }: { settings: MessagingSettings; whatsapp: WhatsappConnectionView; credits: { sms: number; email: number }; quietHours: string | null }) {
  const backups = [
    { key: "sms", label: "SMS", icon: Phone, on: settings.smsEnabled },
    { key: "email", label: "Email", icon: Mail, on: settings.emailEnabled },
  ] as const;
  const waConnected = whatsapp.status === "configured" || whatsapp.status === "live";
  const waTag = !settings.whatsappEnabled ? "Off" : waConnected ? (whatsapp.status === "live" ? "Live" : "Connected") : "Connect your number";

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-text-2">Booking, reminder, and follow-up messages — WhatsApp-first, routed to each client&apos;s preferred channel. Reminders inside a client&apos;s 24-hour window are free; SMS/email are metered backups.</p>

      {/* WhatsApp headline */}
      <div className="flex items-center gap-3 rounded-control border border-accent/25 bg-accent-soft/30 px-3.5 py-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white"><MessageCircle className="size-4" strokeWidth={2.2} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-[660] text-text">
            WhatsApp <span className="rounded-chip bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Primary</span>
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-text-2"><Zap className="size-3 text-accent" strokeWidth={2.2} aria-hidden /> Free replies &amp; reminders in the 24h window</div>
        </div>
        <span className={cn("shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold", settings.whatsappEnabled && waConnected ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-3")}>{waTag}</span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {backups.map((c) => (
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
