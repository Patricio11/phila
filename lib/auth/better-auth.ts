import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendPlatformEmail } from "@/lib/email/platform-email";
import { verificationEmail, resetPasswordEmail, teamInviteEmail, platformInviteEmail } from "@/lib/email/templates";

const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** The org name if this user still has a pending `invited` membership (else null). */
async function pendingInviteOrgName(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ name: schema.orgs.name })
    .from(schema.orgMembers)
    .innerJoin(schema.orgs, eq(schema.orgMembers.orgId, schema.orgs.id))
    .where(and(eq(schema.orgMembers.userId, userId), eq(schema.orgMembers.status, "invited")))
    .limit(1);
  return row?.name ?? null;
}

/** A super-admin who has never signed in  a fresh platform-operator invite. */
async function isFreshOperatorInvite(userId: string, platformRole?: string | null): Promise<boolean> {
  if (platformRole !== "super_admin") return false;
  const [s] = await getDb().select({ id: schema.session.id }).from(schema.session).where(eq(schema.session.userId, userId)).limit(1);
  return !s;
}

/**
 * Better Auth  the real identity layer (Phase 9). Email + password over the
 * Drizzle/Neon adapter. Phila-specific identity (the platform role and, for
 * clients, their linked client record) rides on the user as additional fields;
 * org membership + team role live in `org_members`. The resolved session is
 * mapped into the app's existing `Principal` shape in `lib/auth/session.ts`, so
 * no guard or call site changes.
 */
export const auth = betterAuth({
  appName: "Phila",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Sign-in is refused until the address is verified (W1.8)  protects deliverability
    // and blocks junk signups. The verification email is sent on sign-up below.
    requireEmailVerification: true,
    minPasswordLength: 8,
    // The reset-password token also activates an invited team member / operator
    // ("set your password"). Default is 1h  too short for someone who opens the
    // invite later, so give the join/reset link a friendlier 72-hour window (W-feedback).
    resetPasswordTokenExpiresIn: 60 * 60 * 72,
    // Self-service password reset (W2)  the branded email carries a single-use,
    // expiring token; the /reset-password page exchanges it for a new password. For a
    // still-invited team member this same mechanism is their **activation**: they get a
    // "welcome, set your password" email instead of a plain reset.
    sendResetPassword: async ({ user, token }) => {
      const url = `${APP_URL}/reset-password?token=${token}`;
      const inviteOrg = await pendingInviteOrgName(user.id);
      const isOperatorInvite = !inviteOrg && (await isFreshOperatorInvite(user.id, (user as { platformRole?: string | null }).platformRole));
      const email = inviteOrg
        ? teamInviteEmail(url, user.name, inviteOrg)
        : isOperatorInvite
          ? platformInviteEmail(url, user.name)
          : resetPasswordEmail(url, user.name);
      await sendPlatformEmail({ to: user.email, ...email });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // Better Auth builds `url` (verify endpoint + callback); we deliver the branded email.
    sendVerificationEmail: async ({ user, url }) => {
      await sendPlatformEmail({ to: user.email, ...verificationEmail(url, user.name) });
    },
  },
  user: {
    additionalFields: {
      platformRole: { type: "string", required: false, input: false },
      clientId: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  // Throttle the auth endpoints by IP (W2). Limits are per-IP, so they're kept
  // generous enough that a clinic behind one NAT address isn't locked out, while
  // still blunting brute force. Disabled under test (the shared in-memory bucket
  // would otherwise trip across the suite). A shared store (Upstash/KV) for the full
  // app surface is the broader follow-up in the plan.
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    window: 60,
    max: 80,
    customRules: {
      "/sign-in/email": { window: 60, max: 20 },
      "/sign-up/email": { window: 300, max: 10 },
      "/request-password-reset": { window: 300, max: 10 },
      "/forget-password": { window: 300, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 12 },
    },
  },
  // TOTP 2FA (enforced for super_admin / org_admin / supervisors in the UI).
  // nextCookies() must be last so it can set cookies after every plugin runs.
  plugins: [twoFactor({ issuer: "Phila" }), nextCookies()],
});
