import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ActivateForm } from "@/components/auth/activate-form";

export const metadata: Metadata = { title: "Set up your account · Phila", robots: { index: false, follow: false } };

export default function ActivatePage() {
  return (
    <AuthShell
      title="Welcome to Phila"
      subtitle="Your counsellor invited you to your private space. Set a password to see your sessions, steps, and care plan."
    >
      <ActivateForm />
    </AuthShell>
  );
}
