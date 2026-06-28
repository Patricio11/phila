import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password · Phila", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don't use anywhere else.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
