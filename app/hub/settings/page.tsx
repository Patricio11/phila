import Link from "next/link";
import { Bell } from "lucide-react";
import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import type { BusinessHours } from "@/lib/domain/types";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { IntegrationToggles } from "@/components/hub/integration-toggles";
import { PaymentConnectionCard } from "@/components/hub/payment-connection-card";
import { PublicPageEditor } from "@/components/hub/public-page-editor";
import { BusinessHoursEditor } from "@/components/hub/business-hours-editor";
import { OrgProfileForm, type OrgProfile } from "@/components/hub/org-profile-form";
import { InvoiceSettingsForm } from "@/components/hub/invoice-settings-form";
import { YourPlanCard } from "@/components/hub/your-plan-card";
import { SecuritySettings } from "@/components/hub/security-settings";
import { VideoSettingsCard } from "@/components/hub/video-settings";
import { getVideoSettings } from "@/db/queries/video";
import { AiSettingsCard } from "@/components/hub/ai-settings";
import { getAiSettings, getAiSpendThisMonth, getActiveProvider } from "@/db/queries/ai";
import { getOrgGatewayStatus } from "@/db/queries/org-gateway";
import { getPageStats, defaultContent } from "@/db/queries/public-page";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function HubSettingsPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const [settings, org, invoiceSettings, platform, subscription] = await Promise.all([
    provider.getOrgSettings(membership.orgId),
    provider.getOrg(membership.orgId),
    provider.getInvoiceSettings(membership.orgId),
    provider.getPlatformSettings(),
    provider.getOrgSubscription(membership.orgId, clockNow()),
  ]);
  if (!settings || !org) notFound();
  const videoSettings = await getVideoSettings(membership.orgId);
  const [aiSettings, aiSpent, aiProvider, gateway] = await Promise.all([
    getAiSettings(membership.orgId),
    getAiSpendThisMonth(membership.orgId),
    getActiveProvider(),
    getOrgGatewayStatus(membership.orgId),
  ]);
  const page = await provider.getOrgPublicPage(org.slug);
  const pageContent = page?.content ?? defaultContent({ intro: page?.intro, about: page?.about });
  const pageStats = await getPageStats(membership.orgId);
  const bh: BusinessHours = org.scheduling.businessHours;

  // Seeded org profile (Phase 10 reads these from the org row).
  const profile: OrgProfile = {
    name: org.name,
    tradingName: "",
    registrationNo: "2018/445566/08 · 230-988 NPO",
    practiceNo: "BHF 0556789",
    email: `admin@${org.slug}.org.za`,
    phone: "+27 11 482 7700",
    website: `www.${org.slug}.org.za`,
    address: "44 Frost Avenue, Auckland Park, Johannesburg, 2092",
  };

  return (
    <div className="rise space-y-6">
      <PageHead title="Settings" summary="Your organisation, team security, scheduling, channels, payments, and public page." />

      {/* Organisation profile */}
      <Card>
        <CardHead title="Organisation" />
        <div className="px-[17px] pb-[17px]">
          <OrgProfileForm initial={profile} />
        </div>
      </Card>

      {/* Invoicing & VAT */}
      <Card>
        <CardHead title="Invoicing & VAT" />
        <div className="px-[17px] pb-[17px]">
          <InvoiceSettingsForm initial={invoiceSettings} vatRatePercent={platform.vatRatePercent} paymentsEnabled={Boolean(org.features.payments)} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scheduling */}
        <Card>
          <CardHead title="Scheduling" />
          <div className="space-y-4 px-[17px] pb-[17px]">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Default duration" value={`${org.scheduling.defaultDurationMin} min`} />
              <Stat label="Buffer between sessions" value={`${org.scheduling.bufferMin} min`} />
            </div>
            <BusinessHoursEditor initial={bh} />
          </div>
        </Card>

        {/* Security */}
        <Card>
          <CardHead title="Security" />
          <div className="px-[17px] pb-[17px]">
            <SecuritySettings initialTwoFactor={principal.twoFactorEnabled} />
          </div>
        </Card>

        {/* Notifications (WhatsApp BYO + SMS/Email Phila-credits + templates) */}
        <Card>
          <CardHead title="Notifications" />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-3 text-[12.5px] text-text-2">Booking, reminder and follow-up messages on WhatsApp, SMS and email  routed to each client&apos;s preferred channel. Connect your WhatsApp number, top up SMS/email credits, and edit the wording.</p>
            <Link href="/hub/settings/notifications" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-surface px-3.5 text-[13px] font-medium text-text transition-colors hover:bg-surface-hover">
              <Bell className="size-4" strokeWidth={2} aria-hidden /> Manage notifications
            </Link>
          </div>
        </Card>

        {/* Video (in-app LiveKit, or the org's own meeting link) */}
        <Card>
          <CardHead title="Video sessions" />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-3 text-[12.5px] text-text-2">How online sessions happen  a secure in-region Phila room, or your own meeting link.</p>
            <VideoSettingsCard initial={videoSettings} />
          </div>
        </Card>

        {/* AI scribe (POPIA cross-border consent gate + budget) */}
        <Card>
          <CardHead title="AI assistant" />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-3 text-[12.5px] text-text-2">A de-identified scribe that drafts the session note and the funder fields  the counsellor edits and signs.</p>
            <AiSettingsCard initial={aiSettings} spentCents={aiSpent} providerLive={Boolean(aiProvider)} />
          </div>
        </Card>

        {/* Payments */}
        <Card>
          <CardHead title="Payments  your own gateway" />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-3 text-[12.5px] text-text-2">Connect your gateway so clients pay your org directly for invoices. Funds settle to you; Phila just orchestrates. Switching providers is one choice.</p>
            <PaymentConnectionCard initial={gateway} />
          </div>
        </Card>

        {/* Your Phila plan  billed via the platform's system gateway */}
        {subscription && (
          <Card>
            <CardHead title="Your Phila plan" />
            <div className="px-[17px] pb-[17px]">
              <YourPlanCard subscription={subscription} />
            </div>
          </Card>
        )}

        {/* Platform features */}
        <Card>
          <CardHead title="Platform features" />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-3 text-[12.5px] text-text-2">Everything starts off. Turn on only what you need  nothing sends or leaves until you do.</p>
            <IntegrationToggles initial={org.features} />
          </div>
        </Card>

        {/* Public page */}
        <Card>
          <CardHead title="Public page" />
          <div className="px-[17px] pb-[17px]">
            <PublicPageEditor slug={org.slug} initial={pageContent} stats={pageStats} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-surface-2 p-3">
      <div className="text-[15px] font-[640] text-text">{value}</div>
      <div className="text-[11.5px] text-text-3">{label}</div>
    </div>
  );
}
