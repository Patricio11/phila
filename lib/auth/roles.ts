import type { PlatformRole, TeamRole } from "@/lib/domain/enums";

/**
 * Capabilities  the redaction matrix (ROADMAP.md Appendix) expressed as code.
 * This is the *authorisation vocabulary*; the real gate is the DAL + Postgres
 * RLS in Part B (docs/SECURITY.md). Route guards and these helpers are the UX
 * layer + defence in depth  never the sole boundary.
 *
 * Clinical-note access is special: only the authoring counsellor and their
 * supervisor may read a private note freely. The Hub (org_admin) *can* reach a
 * note, but that access is **audited** (Care-Confidentiality Rule). Front desk,
 * finance, and programme managers can never read a note at all.
 */
export type Capability =
  | "schedule:read_own"
  | "schedule:read_all"
  | "appointments:manage"
  | "rooms:manage"
  | "clients:manage"
  | "contact:read"
  | "notes:author"
  | "care_plan:author"
  | "demographics:read" // still consent-gated at the data layer
  | "intake:manage"
  | "invoicing:manage"
  | "payments:read"
  | "reporting:aggregate"
  | "funders:manage"
  | "team:manage"
  | "settings:manage"
  | "supervision:review";

const TEAM_CAPABILITIES: Record<TeamRole, ReadonlySet<Capability>> = {
  org_admin: new Set<Capability>([
    "schedule:read_all",
    "appointments:manage",
    "rooms:manage",
    "clients:manage",
    "contact:read",
    "demographics:read",
    "intake:manage",
    "invoicing:manage",
    "payments:read",
    "reporting:aggregate",
    "funders:manage",
    "team:manage",
    "settings:manage",
  ]),
  counsellor: new Set<Capability>([
    "schedule:read_own",
    "appointments:manage",
    "clients:manage",
    "contact:read",
    "notes:author",
    "care_plan:author",
    "demographics:read",
  ]),
  front_desk: new Set<Capability>([
    "schedule:read_all",
    "appointments:manage",
    "rooms:manage",
    "clients:manage",
    "contact:read",
    "intake:manage",
  ]),
  finance: new Set<Capability>([
    "invoicing:manage",
    "payments:read",
  ]),
  programme_manager: new Set<Capability>([
    "schedule:read_all",
    "demographics:read",
    "reporting:aggregate",
    "funders:manage",
  ]),
};

export function teamRoleCan(role: TeamRole, capability: Capability): boolean {
  return TEAM_CAPABILITIES[role].has(capability);
}

/**
 * The clinical-note access decision. Returns whether access is allowed and
 * whether it must be **audited** before the body is revealed. A null team role
 * (e.g. the client themselves, or a funder) never reaches a private note here.
 */
export function resolveNoteAccess(opts: {
  role: TeamRole | null;
  isAuthor: boolean;
  isSupervisorOfAuthor: boolean;
}): { allowed: boolean; audited: boolean; reason: string } {
  const { role, isAuthor, isSupervisorOfAuthor } = opts;

  if (isAuthor) return { allowed: true, audited: false, reason: "author" };
  if (isSupervisorOfAuthor)
    return { allowed: true, audited: false, reason: "supervisor" };

  if (role === "org_admin")
    return {
      allowed: true,
      audited: true,
      reason: "hub_override", // recorded access  never silent
    };

  return { allowed: false, audited: false, reason: "not_permitted" };
}

/** Supervising counsellors and platform/org admins use 2FA (Phase 9). */
export function requiresTwoFactor(opts: {
  platformRole: PlatformRole | null;
  teamRole: TeamRole | null;
  isSupervisor: boolean;
}): boolean {
  if (opts.platformRole === "super_admin") return true;
  if (opts.teamRole === "org_admin") return true;
  if (opts.teamRole === "counsellor" && opts.isSupervisor) return true;
  return false;
}
