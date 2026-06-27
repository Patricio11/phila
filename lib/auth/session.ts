import "server-only";
import type { PlatformRole, TeamRole } from "@/lib/domain/enums";

/**
 * The authenticated principal. In Part A this is a fixed mock identity so every
 * role's surface is demoable; Phase 9 replaces `getCurrentPrincipal()` with
 * Better Auth session resolution — the *shape* here is the contract the rest of
 * the app codes against, so that swap changes no call sites.
 *
 * Org staff (counsellor, org_admin, …) carry no platform role — their authority
 * comes from an org membership. `client`, `funder`, and `super_admin` are
 * platform roles. A user may belong to several orgs with a different role in each.
 */
export interface OrgMembership {
  orgId: string;
  orgName: string;
  teamRole: TeamRole;
  isSupervisor: boolean;
}

export interface Principal {
  userId: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
  memberships: OrgMembership[];
  activeOrgId: string | null;
  twoFactorEnabled: boolean;
  /** For platform role `client`: the linked client record (their own data). */
  clientId?: string;
}

/**
 * Part-A mock principal: Nomsa Dlamini — a supervising counsellor at Masizakhe.
 * Switching the demo identity is a one-line change here until real auth lands.
 */
const MOCK_PRINCIPAL: Principal = {
  userId: "user_nomsa",
  name: "Nomsa Dlamini",
  email: "nomsa@masizakhe.org.za",
  platformRole: null,
  memberships: [
    {
      orgId: "org_masizakhe",
      orgName: "Masizakhe Counselling",
      teamRole: "counsellor",
      isSupervisor: true,
    },
  ],
  activeOrgId: "org_masizakhe",
  twoFactorEnabled: true,
};

export async function getCurrentPrincipal(): Promise<Principal> {
  return MOCK_PRINCIPAL;
}

/**
 * Part-A demo client identity: Lerato Mahlangu, a client of Masizakhe. In a
 * no-auth Part A each role's surface assumes its own demo identity so the whole
 * product is clickable; Phase 9 resolves the real session and routes by role.
 */
const MOCK_CLIENT: Principal = {
  userId: "user_lerato",
  name: "Lerato Mahlangu",
  email: "lerato.m@example.co.za",
  platformRole: "client",
  memberships: [],
  activeOrgId: "org_masizakhe",
  twoFactorEnabled: false,
  clientId: "cl_lerato",
};

export async function getClientPrincipal(): Promise<Principal> {
  return MOCK_CLIENT;
}

/** Part-A demo org-admin (the Hub): Thandeka Mbeki, practice manager at Masizakhe. */
const MOCK_ORG_ADMIN: Principal = {
  userId: "user_thandeka",
  name: "Thandeka Mbeki",
  email: "thandeka@masizakhe.org.za",
  platformRole: null,
  memberships: [
    { orgId: "org_masizakhe", orgName: "Masizakhe Counselling", teamRole: "org_admin", isSupervisor: false },
  ],
  activeOrgId: "org_masizakhe",
  twoFactorEnabled: true,
};

export async function getOrgAdminPrincipal(): Promise<Principal> {
  return MOCK_ORG_ADMIN;
}

export function activeMembership(principal: Principal): OrgMembership | null {
  return (
    principal.memberships.find((m) => m.orgId === principal.activeOrgId) ?? null
  );
}
