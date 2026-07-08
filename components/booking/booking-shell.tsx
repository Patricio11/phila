import Link from "next/link";
import { Check } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export interface BookingStepMeta {
  key: string;
  label: string;
}

/**
 * BookingShell (DESIGN.md §8)  the calm stepped frame: the org's brand, a
 * progress thread, and the current step in a card. 360-first: the thread becomes
 * a compact bar + "Step X of N" on small screens.
 */
export function BookingShell({
  orgName,
  orgSlug,
  brand,
  steps,
  current,
  logoUrl = null,
  children,
}: {
  orgName: string;
  orgSlug: string;
  brand: string;
  steps: BookingStepMeta[];
  current: number;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const pct = Math.round(((current + 1) / steps.length) * 100);

  return (
    <div style={{ "--brand": brand } as React.CSSProperties} className="min-h-dvh bg-bg">
      <header className="border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[760px] items-center gap-2.5 px-4 sm:px-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${orgName} logo`} className="size-8 rounded-[9px] object-contain" />
          ) : (
            <span
              className="inline-flex size-8 items-center justify-center rounded-[9px] text-[12px] font-bold text-white shadow-sm"
              style={{ backgroundColor: "var(--brand)" }}
              aria-hidden
            >
              {initials(orgName)}
            </span>
          )}
          <Link href={`/o/${orgSlug}`} className="text-[14.5px] font-[640] tracking-[-0.01em] text-text">
            {orgName}
          </Link>
          <span className="ml-auto text-[12.5px] text-text-3">Book a session</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
        {/* Progress thread  desktop */}
        <ol className="mb-7 hidden items-center sm:flex" aria-label="Booking progress">
          {steps.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={step.key} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                      done && "bg-accent text-accent-ink",
                      active && "bg-accent-soft text-accent ring-2 ring-accent/40",
                      !done && !active && "bg-surface-2 text-text-3",
                    )}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[12.5px] font-medium",
                      active ? "text-text" : done ? "text-text-2" : "text-text-3",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <span className={cn("mx-3 h-px flex-1", done ? "bg-accent/40" : "bg-border")} />
                )}
              </li>
            );
          })}
        </ol>

        {/* Progress thread  mobile */}
        <div className="mb-6 sm:hidden">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-semibold text-text">{steps[current]?.label}</span>
            <span className="text-text-3">
              Step {current + 1} of {steps.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-5 shadow-sm sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
