import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireFunder } from "@/lib/auth/guard";

/**
 * The funder portal shell (DESIGN.md §5.4) — external, read-only, scoped to the
 * funder's grant(s). An always-on banner makes the posture explicit: aggregate,
 * anonymised, nothing identifiable. Every view is audited in the pages.
 */
export default async function FunderLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireFunder();

  return (
    <ToastProvider>
      <AppShell
        navKey="funder"
        orgName="Funder portal"
        user={{ name: principal.name, email: principal.email, roleLabel: "Funder · read-only" }}
      >
        <div className="mb-5 flex items-start gap-2.5 rounded-control border border-accent/25 bg-accent-soft/40 p-3.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-text-2">
            You&apos;re viewing <span className="font-semibold text-text">aggregate, anonymised</span>{" "}
            progress for your grant(s) only. Nothing here identifies a client, and every view is
            recorded.
          </p>
        </div>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
