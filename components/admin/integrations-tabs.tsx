"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, HardDrive, Mail, MessageSquare, Video } from "lucide-react";
import type { IntegrationCatalogItem } from "@/lib/domain/types";
import { PLATFORM_INTEGRATIONS, type PlatformIntegrationSlug } from "@/lib/admin/platform-integrations";
import { IntegrationsCatalogue } from "@/components/admin/integrations-catalogue";
import { cn } from "@/lib/utils";

const ICON: Record<PlatformIntegrationSlug, typeof CreditCard> = {
  paystack: CreditCard, livekit: Video, storage: HardDrive, bulksms: MessageSquare, resend: Mail,
};

type Status = { enabled: boolean; configured: boolean };

export function IntegrationsTabs({ statuses, catalogue }: { statuses: Record<string, Status>; catalogue: IntegrationCatalogItem[] }) {
  const [tab, setTab] = useState<"platform" | "org">("platform");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-control border border-border bg-surface p-0.5">
        <TabBtn active={tab === "platform"} onClick={() => setTab("platform")} label="Phila platform" />
        <TabBtn active={tab === "org"} onClick={() => setTab("org")} label="Org connections" />
      </div>

      {tab === "platform" ? (
        <>
          <p className="text-[12.5px] text-text-3">Phila&apos;s own gateways — payments, video, storage, and messaging. Configure, test, then switch on. Encrypted at rest; never env vars.</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PLATFORM_INTEGRATIONS.map((m) => {
              const st = statuses[m.slug] ?? { enabled: false, configured: false };
              const Icon = ICON[m.slug];
              return (
                <Link
                  key={m.slug}
                  href={`/admin/integrations/${m.slug}`}
                  className="group flex flex-col rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("flex size-9 items-center justify-center rounded-lg", st.enabled ? "bg-accent text-white" : "bg-surface-2 text-text-2")}>
                      <Icon className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-[640] text-text">{m.name}</div>
                      <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-3">{m.category}</div>
                    </div>
                    <StatusPill enabled={st.enabled} configured={st.configured} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12.5px] text-text-2">{m.description}</p>
                  <div className="mt-3 flex items-center justify-end gap-1 text-[13px] font-medium text-accent">
                    Configure <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="text-[12.5px] text-text-3">What each org may connect or use for itself — WhatsApp (their own number), the payment gateways for client invoices, and the providers available platform-wide. Set each off · mock · live.</p>
          <IntegrationsCatalogue initial={catalogue} />
        </>
      )}
    </div>
  );
}

function StatusPill({ enabled, configured }: Status) {
  if (enabled)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent">
        <span className="size-1.5 rounded-full bg-accent" /> Live
      </span>
    );
  if (configured) return <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-text-2">Configured · off</span>;
  return <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-text-3">Not set up</span>;
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-8 rounded-[6px] px-3.5 text-[13px] font-medium transition-colors", active ? "bg-accent text-accent-ink" : "text-text-2 hover:text-text")}
    >
      {label}
    </button>
  );
}
