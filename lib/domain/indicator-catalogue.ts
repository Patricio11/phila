import type { IndicatorMetric } from "@/lib/domain/types";
import type { IndicatorType } from "@/lib/domain/enums";

/**
 * The metrics an org can track against a funder target. Each maps to a live
 * computation in `lib/domain/reporting.ts` (computeIndicator) — the org only picks
 * a metric + a target; the type, unit, default label and rule come from here, so
 * indicators can never be miswired. Shared client + server (pure data).
 */
export interface IndicatorMeta {
  metric: IndicatorMetric;
  label: string;
  type: IndicatorType;
  unit: string;
  rule: string;
  /** A sensible starting target for the picker. */
  defaultTarget: number;
}

export const INDICATOR_CATALOGUE: IndicatorMeta[] = [
  { metric: "unique_clients", label: "Unique clients reached", type: "count", unit: "clients", rule: "Distinct clients tagged to this grant.", defaultTarget: 30 },
  { metric: "sessions_delivered", label: "Sessions delivered", type: "count", unit: "sessions", rule: "Completed sessions for tagged clients within the grant period.", defaultTarget: 200 },
  { metric: "pct_female", label: "Female clients", type: "demographic_proportion", unit: "%", rule: "Share of consented tagged clients recorded as female.", defaultTarget: 60 },
  { metric: "pct_employed", label: "Employed clients", type: "demographic_proportion", unit: "%", rule: "Share of consented tagged clients recorded as employed.", defaultTarget: 40 },
  { metric: "pct_youth", label: "Youth clients (under 25)", type: "demographic_proportion", unit: "%", rule: "Share of consented tagged clients aged under 25.", defaultTarget: 50 },
  { metric: "phq9_improved_5", label: "PHQ-9 improvement (≥5 points)", type: "outcome_delta", unit: "%", rule: "Share of tagged clients whose PHQ-9 fell 5+ points first→latest.", defaultTarget: 70 },
];

export const INDICATOR_METRICS = INDICATOR_CATALOGUE.map((m) => m.metric) as [IndicatorMetric, ...IndicatorMetric[]];

export function indicatorMeta(metric: string): IndicatorMeta | undefined {
  return INDICATOR_CATALOGUE.find((m) => m.metric === metric);
}
