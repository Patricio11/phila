import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { shouldPromptTwoFactor } from "@/lib/auth/two-factor-prompt";
import { effectiveFeaturesDb } from "@/db/queries/features";
import { NumberHealthBanner } from "@/components/hub/number-health-banner";

/**
 * The Org-admin Hub shell (DESIGN.md §5.4). The guard resolves the org-admin
 * identity (Part A demo; Phase 9 the real session). The Hub is the *ceiling* for
 * the org's data  but clinical notes are still author/supervisor-only; any Hub
 * note access is audited (Care-Confidentiality Rule).
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const { principal, membership } = await requireHub();
  const org = await (await getDataProvider()).getOrg(membership.orgId);
  const twoFactorPrompt = await shouldPromptTwoFactor(principal);
  // Nav gates on the *effective* features (kill-switch → override → plan → self-toggle).
  const features = process.env.DATA_PROVIDER === "db" ? await effectiveFeaturesDb(membership.orgId) : org?.features;

  // Batch 2n - the header wears the member's own picture when they have one.
  const photoUrl = process.env.DATA_PROVIDER === "db"
    && (await (await import("@/db/queries/team")).getMemberPhotoDb(membership.orgId, principal.userId)).key
    ? `/api/avatar/${principal.userId}`
    : null;

  // Batch 2u - the Messages badge starts truthful on first paint.
  const unreadMessages = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/messages")).unreadMessageCountDb(principal.userId, membership.orgId)
    : 0;

  // Phase 34.3 - a flagged / restricted WhatsApp number shows a shell-wide banner.
  const health = process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/whatsapp-health")).readNumberHealth(membership.orgId).catch(() => null)
    : null;

  return (
    <ToastProvider>
      <AppShell
        navKey="hub"
        orgName={membership.orgName}
        user={{ name: principal.name, email: principal.email, roleLabel: "Org admin", photoUrl }}
        settingsHref="/hub/settings"
        features={features}
        twoFactorPrompt={twoFactorPrompt}
        unreadMessages={unreadMessages}
        banner={<NumberHealthBanner health={health} />}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
