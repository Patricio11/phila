import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireOrg } from "@/lib/auth/guard";
import { TEAM_ROLE_LABELS } from "@/lib/domain/enums";

/**
 * The counsellor workspace shell (DESIGN.md §5.4). The guard resolves the active
 * org membership — in Part A from the mock principal, in Phase 9 from the real
 * Better Auth session — and the same `<AppShell>` renders for every role.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireOrg(["counsellor"]);
  } catch {
    // In Part A this can't happen; Phase 9 redirects unauthenticated users.
    redirect("/");
  }

  const { principal, membership } = ctx;
  const roleLabel = membership.isSupervisor
    ? "Counsellor · Supervisor"
    : TEAM_ROLE_LABELS[membership.teamRole];

  return (
    <ToastProvider>
      <AppShell
        navKey="counsellor"
        orgName={membership.orgName}
        user={{ name: principal.name, roleLabel }}
        hasNotifications
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
