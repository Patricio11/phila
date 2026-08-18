import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireClient } from "@/lib/auth/guard";
import { clientHasThreadDb } from "@/db/queries/messages";

/**
 * The client portal shell (DESIGN.md §5.4)  the lightest shell. A client only
 * ever sees their own data (Redaction matrix); the guard resolves the client
 * identity (Part A demo; Phase 9 the real session).
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const { principal, clientId } = await requireClient();
  // Phase 34.1 - Messages shows only once the practice has opened a conversation.
  const hasMessages = process.env.DATA_PROVIDER === "db" ? await clientHasThreadDb(clientId) : false;

  return (
    <ToastProvider>
      <AppShell
        navKey="client"
        orgName="Your space"
        user={{ name: principal.name, email: principal.email, roleLabel: "Client" }}
        settingsHref="/me/profile"
        features={{ client_messages: hasMessages }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
