import { notFound } from "next/navigation";
import { FileCheck } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import type { BusinessHours } from "@/lib/domain/types";
import { PageHead } from "@/components/shell/page-head";
import { YourConnections } from "@/components/hub/your-connections";
import { SettingsShell, SettingsPane, type SettingsSection } from "@/components/hub/settings-shell";
import { ClientPortalSettings } from "@/components/hub/client-portal-settings";
import { FundersFeatureToggle } from "@/components/hub/funders-feature-toggle";
import { ReferralsFeatureToggle } from "@/components/hub/referrals-feature-toggle";
import { LanguageFeatureToggle } from "@/components/hub/language-feature-toggle";
import { OrgFeatureToggle } from "@/components/hub/org-feature-toggle";
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
  // Phase 34.4 - the Integrations home: number health + whether the voice rail is on.
  const waHealth = process.env.DATA_PROVIDER === "db" && whatsappConn.status !== "off"
    ? await (await import("@/db/queries/whatsapp-health")).readNumberHealth(membership.orgId) : null;
  const voiceOn = process.env.DATA_PROVIDER === "db" ? await (await import("@/lib/voice")).voiceConfigured() : false;
  // A short-lived signed URL for the current logo (if any + storage is live).
  let logoUrl: string | null = null;
  if (process.env.DATA_PROVIDER === "db") {
    const logo = await getOrgLogoDb(membership.orgId);
    if (logo.key) { try { const s = await getStorageProvider(logo.backend); if (s.status === "live") logoUrl = await s.signedDownloadUrl(logo.key, 3600); } catch { /* wordmark fallback */ } }
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

  // Live status chips on the rail - the state of each area at a glance.
  const channelsOn = [messaging.whatsappEnabled && whatsappConn.status !== "off", messaging.smsEnabled, messaging.emailEnabled].filter(Boolean).length;
  const featuresOn = Object.values(org.features).filter(Boolean).length;
  const gatewayLive = gateway.enabled && gateway.configured;

  const sections: SettingsSection[] = [
    {
      key: "organisation", label: "Organisation", icon: "organisation",
      blurb: "Who you are - profile, brand, verification, your public page.",
      status: onboardingStatus === "verified" ? { label: "Verified", tone: "accent" } : { label: "Verification pending", tone: "warn" },
      panels: [
        { key: "profile", label: "Profile", hint: "The practice's legal identity - printed on invoices, letters and the compliance pack.", node: <SettingsPane><OrgProfileForm initial={profile} /></SettingsPane> },
        { key: "branding", label: "Branding", hint: "Your logo and accent colour - the public page, client portal, invoices and emails wear them.", node: (
          <SettingsPane className="space-y-5">
            <LogoSettings initialUrl={logoUrl} />
            <div className="border-t border-border pt-4"><BrandingSettings initial={org.brandAccent} /></div>
          </SettingsPane>
        ) },
        { key: "portal", label: "Client portal", hint: "What clients see and can do in their private space.", node: <SettingsPane><ClientPortalSettings initial={org.clientPortal} /></SettingsPane> },
        { key: "public", label: "Public page", hint: `Your micro-site at /o/${org.slug} - what the public reads and how they book.`, node: <SettingsPane><PublicPageEditor slug={org.slug} initial={pageContent} stats={pageStats} /></SettingsPane> },
        { key: "verification", label: "Verification", badge: onboardingStatus === "verified" ? "Verified" : "Pending", badgeTone: onboardingStatus === "verified" ? "accent" : "warn", hint: "Company verification - Phila checks the practice before it goes live to the public.", node: <SettingsPane><VerificationStatusCard status={onboardingStatus} profile={p as Record<string, string>} /></SettingsPane> },
      ],
    },
    {
      key: "scheduling", label: "Scheduling", icon: "scheduling",
      blurb: "Session defaults and the hours the practice is open.",
      panels: [
        { key: "defaults", label: "Session defaults", hint: "The default length, the buffer between sessions and how much notice a change needs.", node: <SettingsPane><SchedulingDefaultsForm initial={scheduling} /></SettingsPane> },
        { key: "hours", label: "Business hours", hint: "The week as the practice keeps it - every booking grid, reminder and public slot follows this clock.", node: <SettingsPane><BusinessHoursEditor initial={bh} /></SettingsPane> },
      ],
    },
    {
      key: "messaging", label: "Messaging", icon: "messaging",
      blurb: "How clients hear from you - WhatsApp, SMS, email, templates, alerts.",
      status: channelsOn > 0 ? { label: `${channelsOn} channel${channelsOn === 1 ? "" : "s"} on`, tone: "accent" } : { label: "All off", tone: "muted" },
      panels: [
        { key: "overview", label: "Channels & templates", hint: "A summary here - the full editor (channels, quiet hours, message alerts, every template) lives on its own page.", node: <SettingsPane><MessagingSummary settings={messaging} whatsapp={whatsappConn} credits={credits} quietHours={messaging.quietStart && messaging.quietEnd ? `${messaging.quietStart} to ${messaging.quietEnd}` : null} /></SettingsPane> },
      ],
    },
    {
      key: "billing", label: "Billing & plan", icon: "billing",
      blurb: "Invoicing, how clients pay you, and your Phila plan.",
      status: gatewayLive ? { label: "Gateway live", tone: "accent" } : subscription?.status === "trialing" ? { label: "Trial", tone: "warn" } : undefined,
      panels: [
        { key: "invoicing", label: "Invoicing & VAT", hint: "Numbering, VAT and the wording on every invoice.", node: <SettingsPane><InvoiceSettingsForm initial={invoiceSettings} vatRatePercent={platform.vatRatePercent} paymentsEnabled={Boolean(org.features.payments)} /></SettingsPane> },
        { key: "payments", label: "Payments", badge: gatewayLive ? "Live" : gateway.configured ? "Configured" : undefined, badgeTone: gatewayLive ? "accent" : "muted", hint: "Connect your gateway so clients pay your practice directly. Funds settle to you; Phila just orchestrates.", node: <SettingsPane><PaymentConnectionCard initial={gateway} /></SettingsPane> },
        ...(subscription ? [{ key: "plan", label: "Your Phila plan", badge: subscription.status === "trialing" ? "Trial" : undefined, badgeTone: "warn" as const, hint: "What you're on, what it includes, and when it renews.", node: <SettingsPane><YourPlanCard subscription={subscription} daysLeft={subscription.status === "trialing" ? trialDaysLeft(subscription.nextBillingAt, clockNow()) : undefined} /></SettingsPane> }] : []),
      ],
    },
    {
      key: "integrations", label: "Integrations", icon: "integrations",
      blurb: "What you've connected, what Phila provides, and which features are on.",
      status: { label: `${featuresOn} feature${featuresOn === 1 ? "" : "s"} on`, tone: featuresOn > 0 ? "accent" : "muted" },
      panels: [
        { key: "connections", label: "Your connections", hint: "What this practice has connected for itself, and the rails Phila provides. Each is honest about its state - nothing sends until it's live.", node: <SettingsPane><YourConnections whatsapp={whatsappConn} health={waHealth} gateway={gateway} credits={credits} voiceOn={voiceOn} /></SettingsPane> },
        { key: "features", label: "Platform features", badge: `${featuresOn} on`, badgeTone: featuresOn > 0 ? "accent" : "muted", hint: "Everything starts off. Turn on only what you need - nothing sends or leaves until you do.", node: (
          <SettingsPane className="space-y-2.5">
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
          </SettingsPane>
        ) },
        { key: "video", label: "Video sessions", hint: "How online sessions happen - a secure in-region Phila room, or your own meeting link.", node: <SettingsPane><VideoSettingsCard initial={videoSettings} /></SettingsPane> },
        { key: "ai", label: "AI assistant", badge: aiSettings.aiEnabled ? "On" : undefined, badgeTone: "accent", hint: "A de-identified scribe that drafts the session note and the funder fields - the counsellor edits and signs.", node: <SettingsPane><AiSettingsCard initial={aiSettings} spentCents={aiSpent} providerLive={Boolean(aiProvider)} /></SettingsPane> },
      ],
    },
    {
      key: "security", label: "Security & data", icon: "security",
      blurb: "Your account's protection and the practice's POPIA posture.",
      status: principal.twoFactorEnabled ? { label: "2FA on", tone: "accent" } : { label: "2FA off", tone: "warn" },
      panels: [
        { key: "security", label: "Security", badge: principal.twoFactorEnabled ? "2FA on" : "2FA off", badgeTone: principal.twoFactorEnabled ? "accent" : "warn", hint: "Two-factor authentication and your password.", node: <SettingsPane><SecuritySettings initialTwoFactor={principal.twoFactorEnabled} /></SettingsPane> },
        { key: "compliance", label: "Compliance & POPIA", hint: "Everything runs from what you already record - consent evidence, the access audit, HPCSA-aware retention clocks, Phila's operator register.", node: (
          <SettingsPane className="space-y-3">
            <IoNudge registered={Boolean((p as Record<string, string>).ioRegisteredAt)} />
            <p className="text-[12.5px] text-text-2">One click assembles it all into an auditor-ready pack - nothing to maintain.</p>
            <a
              href="/reports/popia"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[13.5px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95"
            >
              <FileCheck className="size-4" strokeWidth={2} aria-hidden /> Download compliance pack
            </a>
            <p className="text-[11px] text-text-3">Opens as a printable page - save it to PDF. Each generation is recorded in the audit trail.</p>
          </SettingsPane>
        ) },
      ],
    },
  ];

  return (
    <div className="rise space-y-6">
      <PageHead title="Settings" summary="Your organisation, scheduling, billing, integrations, and security - grouped so you can find each in a tap." />
      <SettingsShell sections={sections} />
    </div>
  );
}
