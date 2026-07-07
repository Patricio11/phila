import "server-only";
import { cookies } from "next/headers";
import { requiresTwoFactor } from "@/lib/auth/roles";
import type { Principal } from "@/lib/auth/session";

/** Cookie set when a privileged user dismisses the 2FA nudge ("remind me later"). */
export const TWO_FA_SKIP_COOKIE = "phila_2fa_skip";

/**
 * Whether to show the skippable 2FA nudge on the dashboard (W2). True only for a
 * privileged user (super-admin / org-admin / supervising counsellor) who hasn't
 * enabled 2FA and hasn't recently dismissed the prompt. Never blocks access — it's
 * just a banner.
 */
export async function shouldPromptTwoFactor(principal: Principal): Promise<boolean> {
  if (principal.twoFactorEnabled) return false;
  const m = principal.memberships[0];
  const privileged = requiresTwoFactor({
    platformRole: principal.platformRole,
    teamRole: m?.teamRole ?? null,
    isSupervisor: Boolean(m?.isSupervisor),
  });
  if (!privileged) return false;
  return (await cookies()).get(TWO_FA_SKIP_COOKIE)?.value !== "1";
}
