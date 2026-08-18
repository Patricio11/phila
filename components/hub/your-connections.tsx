import Link from "next/link";
import { ChevronRight, CreditCard, Mail, MessageCircle, PhoneCall, Smartphone, Video } from "lucide-react";
import type { WhatsappConnectionView } from "@/db/queries/messaging";
import { statusGuidance, type NumberHealth } from "@/lib/messaging/whatsapp-health";
import { cn } from "@/lib/utils";

/**
 * Phase 34.4 - the org's Integrations home: everything this practice has
 * connected (its own WhatsApp number, its own payment gateway) and the rails
 * Phila provides for it (video / voice / SMS / email), each with an honest
 * off · configured · live pill and a "manage" link to where it's configured.
 */
export function YourConnections({ whatsapp, health, gateway, credits, voiceOn }: {
  whatsapp: WhatsappConnectionView;
  health: NumberHealth | null;
  gateway: { provider: string | null; enabled: boolean; configured: boolean };
  credits: { sms: number; email: number; video: number; voice: number };
  voiceOn: boolean;
}) {
  const waState: State = whatsapp.status === "live" ? "live" : whatsapp.status === "configured" ? "configured" : "off";
  const gwState: State = gateway.enabled && gateway.configured ? "live" : gateway.configured ? "configured" : "off";
  const guidance = health ? statusGuidance(health) : null;

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Your own connections</h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <ConnectionTile
            icon={MessageCircle}
            title="WhatsApp Business"
            state={waState}
            detail={
              waState === "off"
                ? "Connect your own Meta Cloud API number - reminders and alerts then reach clients on WhatsApp (free inside the 24-hour window)."
                : `${whatsapp.displayPhone ?? `Phone number ID ${whatsapp.phoneNumberId ?? ""}`}${whatsapp.verifiedName ? ` · ${whatsapp.verifiedName}` : ""}`
            }
            extra={waState !== "off" && health ? (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold", guidance ? "bg-warn-soft text-warn" : "bg-surface-2 text-text-2")}>
                Number health · {health.status}{health.quality !== "unknown" ? ` · quality ${health.quality}` : ""}
              </span>
            ) : null}
            href="/hub/settings/notifications"
            cta={waState === "off" ? "Connect" : "Manage"}
          />
          <ConnectionTile
            icon={CreditCard}
            title="Payment gateway"
            state={gwState}
            detail={gwState === "off" ? "Connect your own gateway so clients pay your practice directly for invoices. Funds settle to you." : `${gateway.provider ?? "Gateway"} · ${gwState === "live" ? "taking payments" : "configured, not switched on"}`}
            href="/hub/settings?tab=billing"
            cta={gwState === "off" ? "Connect" : "Manage"}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Provided by Phila</h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <ConnectionTile icon={Video} title="LivePhila video" state="live" detail={`Secure in-region video rooms · ${credits.video.toLocaleString()} min left`} href="/hub/billing" cta="Minutes" />
          {voiceOn && <ConnectionTile icon={PhoneCall} title="VoicePhila calls" state="live" detail={`Bridged calls on the shared number · ${credits.voice.toLocaleString()} min left`} href="/hub/billing" cta="Minutes" />}
          <ConnectionTile icon={Smartphone} title="SMS" state="live" detail={`Phila's bulk SMS · ${credits.sms.toLocaleString()} credits left`} href="/hub/billing" cta="Credits" />
          <ConnectionTile icon={Mail} title="Email" state="live" detail={`Sent from Phila with your name + reply-to · ${credits.email.toLocaleString()} credits left`} href="/hub/settings/notifications" cta="Manage" />
        </div>
      </section>
    </div>
  );
}

type State = "off" | "configured" | "live";

function StatePill({ state }: { state: State }) {
  if (state === "live") return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent"><span className="size-1.5 rounded-full bg-accent" /> Live</span>;
  if (state === "configured") return <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-text-2">Configured · off</span>;
  return <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-text-3">Not set up</span>;
}

function ConnectionTile({ icon: Icon, title, state, detail, extra, href, cta }: {
  icon: typeof Mail; title: string; state: State; detail: string; extra?: React.ReactNode; href: string; cta: string;
}) {
  return (
    <div className="flex flex-col rounded-card border border-border bg-surface p-4" data-testid={`conn-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-lg", state === "live" ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
          <Icon className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-[640] text-text">{title}</div>
          {extra}
        </div>
        <StatePill state={state} />
      </div>
      <p className="mt-2 line-clamp-2 text-[12.5px] text-text-2">{detail}</p>
      <div className="mt-3 flex items-center justify-end">
        <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">{cta} <ChevronRight className="size-4" aria-hidden /></Link>
      </div>
    </div>
  );
}
