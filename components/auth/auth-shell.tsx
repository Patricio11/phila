import Link from "next/link";
import { Lock, MapPin, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand/aloe-mark";

/**
 * AuthShell  the calm, branded frame for sign-in / sign-up / reset. A warm
 * brand panel on the left (desktop), the form on the right. Mobile-first: the
 * brand collapses to a slim header and the form fills the screen.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-surface">
      {/* Brand panel  desktop only */}
      <aside className="relative hidden w-[42%] max-w-[560px] overflow-hidden lg:flex lg:flex-col bg-[radial-gradient(120%_120%_at_0%_0%,var(--color-accent)_0%,#0d5c40_55%,#0a4a34_100%)] p-10 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-[360px] rounded-full bg-black/10 blur-2xl" aria-hidden />

        <Link href="/" className="relative z-10 inline-flex items-center gap-2.5" aria-label="Phila home">
          <BrandMark size={32} />
          <span className="text-[18px] font-[680] tracking-[-0.02em]">Phila</span>
        </Link>

        <div className="relative z-10 mt-auto">
          <p className="max-w-sm text-[26px] font-[640] leading-[1.25] tracking-[-0.02em]">
            The calm operating system for counselling in South Africa.
          </p>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/75">
            Run the daily practice, hold the whole client journey, and let funder-grade reporting fall out of the work.
          </p>
          <ul className="mt-7 space-y-2.5 text-[13px] text-white/85">
            <Trust icon={ShieldCheck}>POPIA-grade, consent at the core</Trust>
            <Trust icon={MapPin}>Client data kept in South Africa</Trust>
            <Trust icon={Lock}>Clinical notes stay private by design</Trust>
          </ul>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 flex-col px-5 py-8 sm:px-10">
        {/* Mobile brand header */}
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5 lg:hidden" aria-label="Phila home">
          <BrandMark size={28} />
          <span className="text-[17px] font-[680] tracking-[-0.02em] text-text">Phila</span>
        </Link>

        <div className="m-auto w-full max-w-[400px] py-4">
          <div className="rise">
            <h1 className="text-[24px] font-[680] tracking-[-0.025em] text-text">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 text-[13px] text-text-2">{footer}</div>}
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-[400px] text-center text-[11px] text-text-3">
          By continuing you agree to Phila&apos;s terms and POPIA-compliant processing of your information.
        </p>
      </main>
    </div>
  );
}

function Trust({ icon: Icon, children }: { icon: typeof Lock; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      {children}
    </li>
  );
}
