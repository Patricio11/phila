/**
 * Sliding-scale / subsidised fees (W7) — an NGO reality that no SA competitor handles.
 * A client can pay the list price, a percentage of it (sliding scale), a flat fee, or
 * nothing (funded). This is pure so it's unit-testable and shared by invoicing + UI.
 */
export type FeeKind = "standard" | "percentage" | "fixed" | "waived";

export interface FeePolicy {
  kind: FeeKind;
  /** percentage: 0–100 (the share the client pays); fixed: cents per session. */
  value?: number;
}

/** The default when no policy is set — the client pays the full list price. */
export const STANDARD_FEE: FeePolicy = { kind: "standard" };

/** What the client actually pays for a session, given the service's list price. Never negative. */
export function effectiveFeeCents(listPriceCents: number, policy: FeePolicy | null | undefined): number {
  const list = Math.max(0, Math.round(listPriceCents));
  if (!policy || policy.kind === "standard") return list;
  switch (policy.kind) {
    case "waived":
      return 0;
    case "percentage": {
      const pct = clampPct(policy.value ?? 100);
      return Math.round((list * pct) / 100);
    }
    case "fixed":
      return Math.max(0, Math.round(policy.value ?? 0));
  }
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 100;
  return Math.min(100, Math.max(0, Math.round(v)));
}

const rands = (cents: number) => `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;

/** A short human label for the fee arrangement (for chips + summaries). */
export function feeLabel(policy: FeePolicy | null | undefined): string {
  if (!policy || policy.kind === "standard") return "Standard fee";
  switch (policy.kind) {
    case "waived":
      return "Waived (funded)";
    case "percentage":
      return `Subsidised · pays ${clampPct(policy.value ?? 100)}%`;
    case "fixed":
      return `Fixed · ${rands(policy.value ?? 0)} / session`;
  }
}

/** True when the arrangement reduces what the client pays (i.e. worth surfacing). */
export function isSubsidised(policy: FeePolicy | null | undefined): boolean {
  return Boolean(policy) && policy!.kind !== "standard";
}
