import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

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
    // Verification + reset are wired to the notifications adapter in Phase 12.
    requireEmailVerification: false,
    minPasswordLength: 8,
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
  // TOTP 2FA (enforced for super_admin / org_admin / supervisors in the UI).
  // nextCookies() must be last so it can set cookies after every plugin runs.
  plugins: [twoFactor({ issuer: "Phila" }), nextCookies()],
});
