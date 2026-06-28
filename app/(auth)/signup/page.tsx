import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your practice · Phila", robots: { index: false, follow: false } };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your practice"
      subtitle="A few details to get started  you'll finish setting up in a moment."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link></>}
    >
      <SignupForm />
    </AuthShell>
  );
}
