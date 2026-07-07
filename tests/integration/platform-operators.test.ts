import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Platform user management — the super-admin can invite another operator, who
 * activates via the set-password link and can then sign in; access is revocable.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || (envFile.match(/^BETTER_AUTH_SECRET=(.+)$/m)?.[1] ?? "").trim();
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || (envFile.match(/^BETTER_AUTH_URL=(.+)$/m)?.[1] ?? "http://localhost:3000").trim();
const sql = neon(process.env.DATABASE_URL);

const { invitePlatformOperatorDb, listPlatformOperatorsDb, isFreshOperatorInviteDb, revokePlatformOperatorDb } = await import("@/db/queries/platform");
const { auth } = await import("@/lib/auth/better-auth");

const EMAIL = "operator.probe@example.com";
const NEW = "operator-pass-4321";

async function cleanup() {
  const users = (await sql`SELECT id FROM "user" WHERE email=${EMAIL}`).map((r) => r.id);
  if (users.length) {
    await sql`DELETE FROM account WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM session WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM "user" WHERE id = ANY(${users})`;
  }
  await sql`DELETE FROM verification WHERE identifier LIKE ${"%" + EMAIL + "%"}`;
}
afterAll(cleanup);

describe("platform operators", () => {
  it("invites a super-admin, activates via set-password, then revokes", { timeout: 30_000 }, async () => {
    await cleanup();

    const { userId, existing } = await invitePlatformOperatorDb("Operator Probe", EMAIL, new Date().toISOString());
    expect(existing).toBe(false);
    const [u] = await sql`SELECT platform_role, email_verified FROM "user" WHERE id=${userId}`;
    expect(u!.platform_role).toBe("super_admin");
    expect(u!.email_verified).toBe(true);

    // Appears as a pending operator; recognised as a fresh operator invite (→ operator email).
    const listed = (await listPlatformOperatorsDb()).find((o) => o.userId === userId);
    expect(listed?.pending).toBe(true);
    expect(await isFreshOperatorInviteDb(userId)).toBe(true);

    // Set password → sign in works.
    await auth.api.requestPasswordReset({ body: { email: EMAIL, redirectTo: "/reset-password" }, headers: new Headers() });
    const rows = await sql`SELECT identifier FROM verification WHERE identifier LIKE 'reset-password:%' AND value=${userId} ORDER BY created_at DESC LIMIT 1`;
    const token = (rows[0]?.identifier as string | undefined)?.split("reset-password:")[1];
    await auth.api.resetPassword({ body: { newPassword: NEW, token: token! }, headers: new Headers() });
    const ok = await auth.api.signInEmail({ body: { email: EMAIL, password: NEW }, headers: new Headers() }).catch(() => null);
    expect(ok).toBeTruthy();

    // Now no longer pending (has a session); revoke clears operator access.
    expect(await isFreshOperatorInviteDb(userId)).toBe(false);
    expect((await revokePlatformOperatorDb(userId)).ok).toBe(true);
    const [after] = await sql`SELECT platform_role FROM "user" WHERE id=${userId}`;
    expect(after!.platform_role).toBeNull();
  });
});
