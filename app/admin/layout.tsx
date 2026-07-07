import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { shouldPromptTwoFactor } from "@/lib/auth/two-factor-prompt";

/**
 * The platform operator console (DESIGN.md §5.4)  cross-org by design, with a
 * 2FA eyebrow on every page (enforced in Phase 9). Every cross-org access and
 * impersonation is audited (Tenant-Isolation Rule).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireSuperAdmin();
  const twoFactorPrompt = await shouldPromptTwoFactor(principal);

  return (
    <ToastProvider>
      <AppShell
        navKey="admin"
        orgName="Phila platform"
        user={{ name: principal.name, email: principal.email, roleLabel: "Super admin" }}
        settingsHref="/admin/settings"
        twoFactorPrompt={twoFactorPrompt}
      >
        <div className="mb-5 flex items-center gap-2 rounded-control border border-border bg-surface-2/60 px-3.5 py-2 text-[12px] text-text-3">
          <ShieldCheck className="size-3.5 text-accent" strokeWidth={2} aria-hidden />
          Two-factor protected · every cross-org action and impersonation is audited.
        </div>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
