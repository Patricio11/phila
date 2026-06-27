import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireClient } from "@/lib/auth/guard";

/**
 * The client portal shell (DESIGN.md §5.4) — the lightest shell. A client only
 * ever sees their own data (Redaction matrix); the guard resolves the client
 * identity (Part A demo; Phase 9 the real session).
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const { principal } = await requireClient();

  return (
    <ToastProvider>
      <AppShell
        navKey="client"
        orgName="Your space"
        user={{ name: principal.name, roleLabel: "Client" }}
        hasNotifications
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
