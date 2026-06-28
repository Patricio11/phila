import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ActivateForm } from "@/components/auth/activate-form";

export const metadata: Metadata = { title: "Set up your account · Phila", robots: { index: false, follow: false } };

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const team = Boolean(role) && role !== "client";
  const destination = !role || role === "client" ? "/me" : role === "org_admin" ? "/hub" : "/app";

  return (
    <AuthShell
      title={team ? "Welcome to the team" : "Welcome to Phila"}
      subtitle={team
        ? "You've been invited to join your practice on Phila. Set a password to access your workspace."
        : "Your counsellor invited you to your private space. Set a password to see your sessions, steps, and care plan."}
    >
      <ActivateForm destination={destination} team={team} />
    </AuthShell>
  );
}
