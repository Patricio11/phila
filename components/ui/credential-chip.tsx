import { BadgeCheck, Clock, ShieldQuestion } from "lucide-react";
import type { CredentialBody, CredentialStatus } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

/**
 * CredentialChip (DESIGN.md §6) — an honest registration signal: verified (with
 * the body, e.g. HPCSA · ASCHP · SACSSP), pending, or unverified. Never
 * default-verified; trust signals must be truthful (Honest Trust Signals).
 */
export function CredentialChip({
  body,
  status,
  className,
}: {
  body: CredentialBody;
  status: CredentialStatus;
  className?: string;
}) {
  if (status === "verified") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent",
          className,
        )}
      >
        <BadgeCheck className="size-3.5" strokeWidth={2.2} aria-hidden />
        {body} verified
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-pill bg-warn-soft px-2 py-0.5 text-[11.5px] font-semibold text-warn",
          className,
        )}
      >
        <Clock className="size-3.5" strokeWidth={2.2} aria-hidden />
        {body} pending
      </span>
    );
  }
  // unverified / rejected — never imply a credential we don't have.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-text-3",
        className,
      )}
    >
      <ShieldQuestion className="size-3.5" strokeWidth={2} aria-hidden />
      {body} not yet verified
    </span>
  );
}
