import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in · Phila", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your practice workspace."
      footer={<>New to Phila? <Link href="/signup" className="font-medium text-accent hover:underline">Create your practice</Link></>}
    >
      <LoginForm />
    </AuthShell>
  );
}
