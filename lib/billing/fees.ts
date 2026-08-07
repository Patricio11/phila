/**
 * Subsidised fees (W7, reworked batch 2g). A client pays the list price, or
 * nothing - either grant/donor funded (`waived`) or covered by an employer's
 * retainer (`retainer`, the EAP reality). `percentage`/`fixed` are LEGACY: no
 * longer offered in the picker, but the engine still honours clients who
 * already have one (records never distort). Pure - unit-testable and shared
 * by invoicing + UI.
 */
export type FeeKind = "standard" | "percentage" | "fixed" | "waived" | "retainer";

export interface FeePolicy {
  kind: FeeKind;
  /** percentage: 0–100 (the share the client pays); fixed: cents per session. */
  value?: number;
}

/** The default when no policy is set - the client pays the full list price. */
export const STANDARD_FEE: FeePolicy = { kind: "standard" };

/** What the client actually pays for a session, given the service's list price. Never negative. */
export function effectiveFeeCents(listPriceCents: number, policy: FeePolicy | null | undefined): number {
  const list = Math.max(0, Math.round(listPriceCents));
  if (!policy || policy.kind === "standard") return list;
  switch (policy.kind) {
    case "waived":
    case "retainer":
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
    case "retainer":
      return "Waived (company retainer)";
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
