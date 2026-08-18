import { TEAM_ROLE_LABELS, type TeamRole } from "@/lib/domain/enums";

/** Phase 34.1 - a member's role label, including the client's own login. */
export function roleLabel(role: TeamRole | "client" | string): string {
  if (role === "client") return "Client";
  return (TEAM_ROLE_LABELS as Record<string, string>)[role] ?? role;
}
