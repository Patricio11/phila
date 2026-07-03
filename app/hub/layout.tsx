import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";

/**
 * The Org-admin Hub shell (DESIGN.md §5.4). The guard resolves the org-admin
 * identity (Part A demo; Phase 9 the real session). The Hub is the *ceiling* for
 * the org's data  but clinical notes are still author/supervisor-only; any Hub
 * note access is audited (Care-Confidentiality Rule).
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const { principal, membership } = await requireHub();
  const org = await (await getDataProvider()).getOrg(membership.orgId);

  return (
    <ToastProvider>
      <AppShell
        navKey="hub"
        orgName={membership.orgName}
        user={{ name: principal.name, email: principal.email, roleLabel: "Org admin" }}
        settingsHref="/hub/settings"
        features={org?.features}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
