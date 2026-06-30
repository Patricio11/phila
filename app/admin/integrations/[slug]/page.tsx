import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getPlatformIntegration, getPlatformIntegrationStatus } from "@/db/queries/platform-integrations";
import { platformIntegrationBySlug } from "@/lib/admin/platform-integrations";
import { PlatformPspCard } from "@/components/admin/platform-psp-card";
import { PlatformVideoCard } from "@/components/admin/platform-video-card";
import { PlatformStorageCard } from "@/components/admin/platform-storage-card";
import { PlatformSmsCard } from "@/components/admin/platform-sms-card";
import { PlatformEmailCard } from "@/components/admin/platform-email-card";

export const dynamic = "force-dynamic";

export default async function IntegrationConfigPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSuperAdmin();
  const { slug } = await params;
  const meta = platformIntegrationBySlug(slug);
  if (!meta) notFound();

  let card: ReactNode = null;
  if (slug === "paystack") {
    card = <PlatformPspCard initial={await getPlatformIntegrationStatus("paystack")} />;
  } else if (slug === "livekit") {
    const raw = await getPlatformIntegration("livekit");
    card = (
      <PlatformVideoCard
        initial={{
          enabled: raw?.enabled ?? false,
          configured: Boolean(raw?.creds.apiSecret),
          mode: (raw?.creds.mode === "live" ? "live" : "demo") as "demo" | "live",
          wsUrl: raw?.creds.wsUrl ?? "",
          apiKey: raw?.creds.apiKey ?? "",
        }}
      />
    );
  } else if (slug === "storage") {
    const raw = await getPlatformIntegration("phila_storage");
    card = (
      <PlatformStorageCard
        initial={{ enabled: raw?.enabled ?? false, configured: Boolean(raw?.creds.serviceKey), url: raw?.creds.url ?? "", bucket: raw?.creds.bucket ?? "" }}
      />
    );
  } else if (slug === "bulksms") {
    card = <PlatformSmsCard initial={await getPlatformIntegrationStatus("bulksms")} />;
  } else if (slug === "resend") {
    const raw = await getPlatformIntegration("resend");
    card = <PlatformEmailCard initial={{ enabled: raw?.enabled ?? false, configured: Boolean(raw?.creds.apiKey), from: raw?.creds.from ?? "" }} />;
  } else {
    notFound();
  }

  return (
    <div className="rise mx-auto max-w-xl space-y-5">
      <Link href="/admin/integrations" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 transition-colors hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Integrations
      </Link>
      <div>
        <h1 className="text-[20px] font-[680] tracking-[-0.01em] text-text">{meta.name}</h1>
        <p className="mt-0.5 text-[13px] text-text-2">{meta.description}</p>
      </div>
      {card}
    </div>
  );
}
