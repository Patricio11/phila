import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgs, subscriptions, platformFeatureFlags, orgFeatureOverrides } from "@/db/schema";
import { ORG_FEATURES, type OrgFeature } from "@/lib/domain/enums";
import { planIncludesFeature, FEATURE_REGISTRY } from "@/lib/domain/features";
import { getPlanByIdDb } from "@/db/queries/plans";

/**
 * The entitlement resolver (W3.1). One precedence chain, used by `requireOrgFeature`,
 * the hub UI, and the admin console so a feature resolves the same way everywhere:
 *
 *   platform kill-switch (force OFF)   →  super-admin disables it across Phila
 *   → org override force_off / force_on →  super-admin per-org suspend / beta-grant
 *   → plan entitlement                 →  does the org's plan include it?
 *   → org self-toggle (orgs.features)  →  the practice's own on/off (today's behaviour)
 *
 * Reads run on the owner connection: the kill-switch table is super-admin-only under
 * RLS, and the caller is already authorised by its own guard.
 */
export type OverrideState = "force_on" | "force_off" | "inherit";
export type FeatureSource = "platform" | "override" | "plan" | "self";

export interface FeatureResolution {
  feature: OrgFeature;
  enabled: boolean;
  source: FeatureSource;
  reason: string;
  /** True only when the org's own toggle is the deciding factor (else it's locked). */
  orgControllable: boolean;
  /** The org's raw self-toggle, regardless of what wins. */
  selfEnabled: boolean;
  /** The super-admin's per-org override (for the admin panel). */
  override: OverrideState;
  overrideReason: string | null;
}

/** The kill-switch map: feature → disabled-globally. */
export async function getPlatformFeatureFlagsDb(): Promise<Record<string, boolean>> {
  const rows = await getDb().select().from(platformFeatureFlags);
  return Object.fromEntries(rows.map((r) => [r.feature, r.disabled]));
}

export async function setPlatformFeatureDb(feature: OrgFeature, disabled: boolean): Promise<void> {
  const now = new Date();
  await getDb().insert(platformFeatureFlags).values({ feature, disabled, updatedAt: now })
    .onConflictDoUpdate({ target: platformFeatureFlags.feature, set: { disabled, updatedAt: now } });
}

export async function setOrgFeatureOverrideDb(orgId: string, feature: OrgFeature, state: OverrideState, reason: string | null, setBy: string): Promise<void> {
  const now = new Date();
  await getDb().insert(orgFeatureOverrides).values({ orgId, feature, state, reason, setBy, setAt: now })
    .onConflictDoUpdate({ target: [orgFeatureOverrides.orgId, orgFeatureOverrides.feature], set: { state, reason, setBy, setAt: now } });
}

/** Resolve every feature for an org (the single computation the whole app trusts). */
export async function resolveAllFeaturesDb(orgId: string): Promise<Record<OrgFeature, FeatureResolution>> {
  const db = getDb();
  const [[org], subRows, flagRows, overrideRows] = await Promise.all([
    db.select({ features: orgs.features }).from(orgs).where(eq(orgs.id, orgId)).limit(1),
    db.select({ planId: subscriptions.planId }).from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1),
    db.select().from(platformFeatureFlags),
    db.select().from(orgFeatureOverrides).where(eq(orgFeatureOverrides.orgId, orgId)),
  ]);
  const selfFeatures = (org?.features as Record<string, boolean> | undefined) ?? {};
  const plan = await getPlanByIdDb(subRows[0]?.planId ?? "p_community");
  const planName = plan?.name ?? "current";
  const killed = new Set(flagRows.filter((f) => f.disabled).map((f) => f.feature));
  const overrideOf = new Map(overrideRows.map((o) => [o.feature, o]));

  const out = {} as Record<OrgFeature, FeatureResolution>;
  for (const feature of ORG_FEATURES) {
    const ov = overrideOf.get(feature);
    const override = (ov?.state as OverrideState) ?? "inherit";
    const overrideReason = ov?.reason ?? null;
    const selfEnabled = Boolean(selfFeatures[feature]);
    const base: Omit<FeatureResolution, "enabled" | "source" | "reason" | "orgControllable"> = { feature, selfEnabled, override, overrideReason };

    if (killed.has(feature)) {
      out[feature] = { ...base, enabled: false, source: "platform", reason: `${FEATURE_REGISTRY[feature].label} is turned off across Phila.`, orgControllable: false };
    } else if (override === "force_off") {
      out[feature] = { ...base, enabled: false, source: "override", reason: overrideReason || "Suspended for your practice by Phila.", orgControllable: false };
    } else if (override === "force_on") {
      out[feature] = { ...base, enabled: true, source: "override", reason: overrideReason || "Enabled for your practice by Phila.", orgControllable: false };
    } else if (!planIncludesFeature(plan, feature)) {
      out[feature] = { ...base, enabled: false, source: "plan", reason: `Not included in the ${planName} plan — upgrade to enable.`, orgControllable: false };
    } else {
      out[feature] = { ...base, enabled: selfEnabled, source: "self", reason: selfEnabled ? "On" : "Off — turn it on in Settings.", orgControllable: true };
    }
  }
  return out;
}

/** Resolve a single feature (convenience over `resolveAllFeaturesDb`). */
export async function resolveFeatureDb(orgId: string, feature: OrgFeature): Promise<FeatureResolution> {
  return (await resolveAllFeaturesDb(orgId))[feature];
}

/** Just the effective on/off map — for nav gating + `requireOrgFeature`. */
export async function effectiveFeaturesDb(orgId: string): Promise<Record<OrgFeature, boolean>> {
  const all = await resolveAllFeaturesDb(orgId);
  return Object.fromEntries(ORG_FEATURES.map((f) => [f, all[f].enabled])) as Record<OrgFeature, boolean>;
}
