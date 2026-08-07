import { notFound } from "next/navigation";
import { FileCheck } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import type { BusinessHours } from "@/lib/domain/types";
import { PageHead } from "@/components/shell/page-head";
import { SettingsTabs } from "@/components/hub/settings-tabs";
import { ClientPortalSettings } from "@/components/hub/client-portal-settings";
import { FundersFeatureToggle } from "@/components/hub/funders-feature-toggle";
import { ReferralsFeatureToggle } from "@/components/hub/referrals-feature-toggle";
import { LanguageFeatureToggle } from "@/components/hub/language-feature-toggle";
import { OrgFeatureToggle } from "@/components/hub/org-feature-toggle";
import { Card, CardHead } from "@/components/ui/card";
import { IntegrationToggles } from "@/components/hub/integration-toggles";
import { PaymentConnectionCard } from "@/components/hub/payment-connection-card";
import { PublicPageEditor } from "@/components/hub/public-page-editor";
import { BusinessHoursEditor } from "@/components/hub/business-hours-editor";
import { SchedulingDefaultsForm } from "@/components/hub/scheduling-defaults-form";
import { OrgProfileForm, type OrgProfile } from "@/components/hub/org-profile-form";
import { BrandingSettings } from "@/components/hub/branding-settings";
import { LogoSettings } from "@/components/hub/logo-settings";
import { getOrgLogoDb } from "@/db/queries/settings";
import { getStorageProvider } from "@/lib/storage";
import { MessagingSummary } from "@/components/hub/messaging-summary";
import { getMessagingSettings, getCreditBalances, getWhatsappConnection } from "@/db/queries/messaging";
import { VerificationStatusCard } from "@/components/hub/verification-status-card";
import { getOnboardingStatusDb } from "@/db/queries/onboarding";
import { InvoiceSettingsForm } from "@/components/hub/invoice-settings-form";
import { YourPlanCard } from "@/components/hub/your-plan-card";
import { trialDaysLeft } from "@/lib/billing/plans";
import { SecuritySettings } from "@/components/hub/security-settings";
import { IoNudge } from "@/components/hub/io-nudge";
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
  // Feature resolutions for the org-toggleable switches, so each is honest
  // about being locked by a Phila kill-switch / override / plan.
  const featureRes = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/features")).resolveAllFeaturesDb(membership.orgId)
    : null;
  const langRes = featureRes?.language ?? null;
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
  const [messaging, credits, whatsappConn] = await Promise.all([
    getMessagingSettings(membership.orgId),
    getCreditBalances(membership.orgId),
    getWhatsappConnection(membership.orgId),
  ]);
  // A short-lived signed URL for the current logo (if any + storage is live).
  let logoUrl: string | null = null;
  if (process.env.DATA_PROVIDER === "db") {
    const { key } = await getOrgLogoDb(membership.orgId);
    if (key) { try { const s = await getStorageProvider(); if (s.status === "live") logoUrl = await s.signedDownloadUrl(key, 3600); } catch { /* wordmark fallback */ } }
  }
  // Fall back to a standard week if an org has no business hours set yet (robust
  // for lightweight/just-created orgs).
  const DEFAULT_HOURS = { 1: { start: "08:00", end: "17:00" }, 2: { start: "08:00", end: "17:00" }, 3: { start: "08:00", end: "17:00" }, 4: { start: "08:00", end: "17:00" }, 5: { start: "08:00", end: "17:00" }, 6: null, 7: null };
  const bh: BusinessHours = (org.scheduling.businessHours ?? DEFAULT_HOURS) as BusinessHours;
  const scheduling = { defaultDurationMin: org.scheduling.defaultDurationMin ?? 60, bufferMin: org.scheduling.bufferMin ?? 10, changeNoticeHours: org.scheduling.changeNoticeHours ?? 24 };

  const onboardingStatus = process.env.DATA_PROVIDER === "db" ? await getOnboardingStatusDb(membership.orgId) : "verified";

  // The org's real practice profile (persisted on the org row); blank until set.
  const p = org.profile ?? {};
  const profile: OrgProfile = {
    name: org.name,
    tradingName: p.tradingName ?? "",
    registrationNo: p.registrationNo ?? "",
    practiceNo: p.practiceNo ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    website: p.website ?? "",
    address: p.address ?? "",
  };

  return (
    <div className="rise space-y-6">
      <PageHead title="Settings" summary="Your organisation, scheduling, billing, integrations, and security  grouped so you can find each in a tap." />

      <SettingsTabs
        organisation={
          <>
            <Card>
              <CardHead title="Company verification" />
              <div className="px-[17px] pb-[17px]">
                <VerificationStatusCard status={onboardingStatus} profile={p as Record<string, string>} />
              </div>
            </Card>
            <Card>
              <CardHead title="Organisation profile" />
              <div className="px-[17px] pb-[17px]">
                <OrgProfileForm initial={profile} />
              </div>
            </Card>
            <Card>
              <CardHead title="Branding" />
              <div className="space-y-5 px-[17px] pb-[17px]">
                <LogoSettings initialUrl={logoUrl} />
                <div className="border-t border-border pt-4">
                  <BrandingSettings initial={org.brandAccent} />
                </div>
              </div>
            </Card>
            <Card>
              <CardHead title="Client portal" />
              <div className="px-[17px] pb-[17px]">
                <ClientPortalSettings initial={org.clientPortal} />
              </div>
            </Card>
            <Card>
              <CardHead title="Public page" />
              <div className="px-[17px] pb-[17px]">
                <PublicPageEditor slug={org.slug} initial={pageContent} stats={pageStats} />
              </div>
            </Card>
          </>
        }
        scheduling={
          <Card>
            <CardHead title="Scheduling" />
            <div className="space-y-5 px-[17px] pb-[17px]">
              <SchedulingDefaultsForm initial={scheduling} />
              <div className="border-t border-border pt-4">
                <BusinessHoursEditor initial={bh} />
              </div>
            </div>
          </Card>
        }
        billing={
          <>
            <Card>
              <CardHead title="Invoicing & VAT" />
              <div className="px-[17px] pb-[17px]">
                <InvoiceSettingsForm initial={invoiceSettings} vatRatePercent={platform.vatRatePercent} paymentsEnabled={Boolean(org.features.payments)} />
              </div>
            </Card>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Card>
                <CardHead title="Payments  your own gateway" />
                <div className="px-[17px] pb-[17px]">
                  <p className="mb-3 text-[12.5px] text-text-2">Connect your gateway so clients pay your org directly for invoices. Funds settle to you; Phila just orchestrates. Switching providers is one choice.</p>
                  <PaymentConnectionCard initial={gateway} />
                </div>
              </Card>
              {subscription && (
                <Card>
                  <CardHead title="Your Phila plan" />
                  <div className="px-[17px] pb-[17px]">
                    <YourPlanCard subscription={subscription} daysLeft={subscription.status === "trialing" ? trialDaysLeft(subscription.nextBillingAt, clockNow()) : undefined} />
                  </div>
                </Card>
              )}
            </div>
          </>
        }
        messaging={
          <Card>
            <CardHead title="Messaging & notifications" />
            <div className="px-[17px] pb-[17px]">
              <MessagingSummary settings={messaging} whatsapp={whatsappConn} credits={credits} quietHours={messaging.quietStart && messaging.quietEnd ? `${messaging.quietStart} to ${messaging.quietEnd}` : null} />
            </div>
          </Card>
        }
        integrations={
          <>
            <Card>
              <CardHead title="Platform features" />
              <div className="space-y-2.5 px-[17px] pb-[17px]">
                <p className="text-[12.5px] text-text-2">Everything starts off. Turn on only what you need  nothing sends or leaves until you do.</p>
                <IntegrationToggles initial={org.features} />
                <FundersFeatureToggle initial={Boolean(org.features.funders)} />
                <ReferralsFeatureToggle initial={Boolean(org.features.referrals)} />
                <LanguageFeatureToggle
                  initial={langRes ? langRes.selfEnabled : Boolean(org.features.language)}
                  locked={langRes ? !langRes.orgControllable : false}
                  lockedReason={langRes && !langRes.orgControllable ? langRes.reason : undefined}
                />
                <OrgFeatureToggle
                  feature="waitlist"
                  label="Client waitlist"
                  description="Hold clients waiting for a space and book them in the moment a slot opens - an Add-to-waitlist action on each client and a waitlist queue on the Appointments page."
                  onDescription="Add to waitlist appears on client dossiers, and the queue shows on Appointments."
                  offDescription="Hidden everywhere. Anyone already on the list is kept, never lost."
                  initial={featureRes ? featureRes.waitlist.selfEnabled : Boolean(org.features.waitlist)}
                  locked={featureRes ? !featureRes.waitlist.orgControllable : false}
                  lockedReason={featureRes && !featureRes.waitlist.orgControllable ? featureRes.waitlist.reason : undefined}
                />
                <OrgFeatureToggle
                  feature="outcomes"
                  label="Outcome tracking"
                  description="Measure client progress with PHQ-9 / GAD-7 between sessions - captured in session notes, with trend charts on client dossiers and the counsellor dashboard."
                  onDescription="Counsellors can capture measures and everyone sees the trends."
                  offDescription="Capture and charts are hidden. Measures already taken are kept, never deleted."
                  initial={featureRes ? featureRes.outcomes.selfEnabled : Boolean(org.features.outcomes)}
                  locked={featureRes ? !featureRes.outcomes.orgControllable : false}
                  lockedReason={featureRes && !featureRes.outcomes.orgControllable ? featureRes.outcomes.reason : undefined}
                />
              </div>
            </Card>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Card>
                <CardHead title="Video sessions" />
                <div className="px-[17px] pb-[17px]">
                  <p className="mb-3 text-[12.5px] text-text-2">How online sessions happen  a secure in-region Phila room, or your own meeting link.</p>
                  <VideoSettingsCard initial={videoSettings} />
                </div>
              </Card>
              <Card>
                <CardHead title="AI assistant" />
                <div className="px-[17px] pb-[17px]">
                  <p className="mb-3 text-[12.5px] text-text-2">A de-identified scribe that drafts the session note and the funder fields  the counsellor edits and signs.</p>
                  <AiSettingsCard initial={aiSettings} spentCents={aiSpent} providerLive={Boolean(aiProvider)} />
                </div>
              </Card>
            </div>
          </>
        }
        security={
          <>
            <Card>
              <CardHead title="Security" />
              <div className="px-[17px] pb-[17px]">
                <SecuritySettings initialTwoFactor={principal.twoFactorEnabled} />
              </div>
            </Card>

            <Card>
              <CardHead title="Compliance & POPIA" />
              <div className="space-y-3 px-[17px] pb-[17px]">
                <IoNudge registered={Boolean((p as Record<string, string>).ioRegisteredAt)} />
                <p className="text-[12.5px] text-text-2">
                  Everything runs from what you already record: consent evidence, the access audit, HPCSA-aware
                  retention clocks, and Phila&apos;s operator register. One click assembles it into an
                  auditor-ready pack - nothing to maintain.
                </p>
                <a
                  href="/reports/popia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[13.5px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95"
                >
                  <FileCheck className="size-4" strokeWidth={2} aria-hidden /> Download compliance pack
                </a>
                <p className="text-[11px] text-text-3">Opens as a printable page - save it to PDF. Each generation is recorded in the audit trail.</p>
              </div>
            </Card>
          </>
        }
      />
    </div>
  );
}
