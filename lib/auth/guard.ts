import "server-only";
import type { OrgFeature, PlatformRole, TeamRole } from "@/lib/domain/enums";
import { teamRoleCan, type Capability } from "@/lib/auth/roles";
import {
  activeMembership,
  getClientPrincipal,
  getCurrentPrincipal,
  type OrgMembership,
  type Principal,
} from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data-provider";

/**
 * Route/RBAC guard scaffold (ROADMAP Task 0.2). Three layers protect every
 * surface (docs/SECURITY.md): the route guard (UX), the DAL (the real gate), and
 * Server Actions (defence in depth). These helpers are the *UX layer* — they
 * resolve the principal and fail closed. In Phase 9 they redirect to sign-in;
 * here they throw typed errors so the demo surfaces the blocked state honestly.
 */
export class AuthError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "AuthError";
  }
}
export class ForbiddenError extends Error {
  constructor(message = "Not permitted") {
    super(message);
    this.name = "ForbiddenError";
  }
}
/** A feature is off, not broken (Dormant-by-Default Rule) — names the next step. */
export class FeatureDormantError extends Error {
  constructor(public feature: OrgFeature) {
    super(`Feature "${feature}" is not enabled for this organisation.`);
    this.name = "FeatureDormantError";
  }
}

export async function requireAuth(): Promise<Principal> {
  const principal = await getCurrentPrincipal();
  if (!principal) throw new AuthError();
  return principal;
}

export async function requirePlatformRole(role: PlatformRole): Promise<Principal> {
  const principal = await requireAuth();
  if (principal.platformRole !== role)
    throw new ForbiddenError(`Requires platform role: ${role}`);
  return principal;
}

/**
 * Resolve the authenticated **client** and their linked client record. The
 * client only ever sees their own data (Redaction matrix). Part A returns the
 * demo client; Phase 9 resolves the real client session.
 */
export async function requireClient(): Promise<{ principal: Principal; clientId: string }> {
  const principal = await getClientPrincipal();
  if (principal.platformRole !== "client" || !principal.clientId)
    throw new ForbiddenError("Requires a client account");
  return { principal, clientId: principal.clientId };
}

/** Resolve the active org membership, optionally asserting a team role. */
export async function requireOrg(
  oneOf?: TeamRole[],
): Promise<{ principal: Principal; membership: OrgMembership }> {
  const principal = await requireAuth();
  const membership = activeMembership(principal);
  if (!membership) throw new ForbiddenError("No active organisation");
  if (oneOf && !oneOf.includes(membership.teamRole))
    throw new ForbiddenError(`Requires org role: ${oneOf.join(" | ")}`);
  return { principal, membership };
}

/** Assert a capability within the active org (maps to the redaction matrix). */
export async function requireCapability(
  capability: Capability,
): Promise<{ principal: Principal; membership: OrgMembership }> {
  const ctx = await requireOrg();
  if (!teamRoleCan(ctx.membership.teamRole, capability))
    throw new ForbiddenError(`Missing capability: ${capability}`);
  return ctx;
}

/**
 * Assert an org feature is enabled. The AI toggle is also the POPIA cross-border
 * consent gate (Dormant-by-Default Rule), so this is a real boundary, not cosmetic.
 */
export async function requireOrgFeature(feature: OrgFeature): Promise<void> {
  const { membership } = await requireOrg();
  const provider = await getDataProvider();
  const org = await provider.getOrg(membership.orgId);
  if (!org || !org.features[feature]) throw new FeatureDormantError(feature);
}

/**
 * Scope a funder to their grant(s) only — read-only, aggregate, audited
 * (Phase 9 wires the real grant edges). Present now so funder surfaces can be
 * coded against it.
 */
export async function requireFunderGrant(grantId: string): Promise<Principal> {
  const principal = await requirePlatformRole("funder");
  // Part A: scope resolution is mocked; Phase 9 checks funder_contacts ↔ grant.
  void grantId;
  return principal;
}
