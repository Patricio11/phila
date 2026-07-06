import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W2 — password reset is real (Better Auth). Request a reset, exchange the single-use
 * token for a new password, and prove the new password signs in while the old one
 * doesn't. Runs the actual auth instance against the DB.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || (envFile.match(/^BETTER_AUTH_SECRET=(.+)$/m)?.[1] ?? "").trim();
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || (envFile.match(/^BETTER_AUTH_URL=(.+)$/m)?.[1] ?? "http://localhost:3000").trim();
const sql = neon(process.env.DATABASE_URL);

const { auth } = await import("@/lib/auth/better-auth");

const EMAIL = "reset.probe@example.com";
const OLD = "old-pass-1234";
const NEW = "new-pass-5678";

async function cleanup() {
  const users = (await sql`SELECT id FROM "user" WHERE email=${EMAIL}`).map((r) => r.id);
  if (users.length) {
    await sql`DELETE FROM account WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM session WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM "user" WHERE id = ANY(${users})`;
  }
  await sql`DELETE FROM verification WHERE identifier LIKE ${"%" + EMAIL + "%"} OR value = ANY(${users.length ? users : ["__none__"]})`;
}

beforeAll(async () => {
  await cleanup();
  await auth.api.signUpEmail({ body: { email: EMAIL, password: OLD, name: "Reset Probe" }, headers: new Headers() });
  await sql`UPDATE "user" SET email_verified = true WHERE email=${EMAIL}`;
});
afterAll(cleanup);

describe("password reset", () => {
  it("issues a single-use token that swaps the password", { timeout: 30_000 }, async () => {
    // Sanity: the OLD password signs in before reset.
    const before = await auth.api.signInEmail({ body: { email: EMAIL, password: OLD }, headers: new Headers() }).catch(() => null);
    expect(before).toBeTruthy();

    // Request the reset — Better Auth writes a reset token to `verification`.
    await auth.api.requestPasswordReset({ body: { email: EMAIL, redirectTo: "/reset-password" }, headers: new Headers() });
    const rows = await sql`SELECT identifier, value FROM verification WHERE identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 5`;
    const token = (rows[0]?.identifier as string | undefined)?.split("reset-password:")[1];
    expect(token).toBeTruthy();

    // Exchange the token for the new password.
    await auth.api.resetPassword({ body: { newPassword: NEW, token: token! }, headers: new Headers() });

    // The NEW password now works; the OLD one is rejected.
    const withNew = await auth.api.signInEmail({ body: { email: EMAIL, password: NEW }, headers: new Headers() }).catch(() => null);
    expect(withNew).toBeTruthy();
    const withOld = await auth.api.signInEmail({ body: { email: EMAIL, password: OLD }, headers: new Headers() }).catch(() => null);
    expect(withOld).toBeNull();
  });
});
