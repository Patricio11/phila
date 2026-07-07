import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W2 — invited-member activation. Inviting provisions a user + credential account +
 * an `invited` membership; the set-password link (Better Auth reset token) lets them
 * choose a password; the first sign-in flips them `invited → active`.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || (envFile.match(/^BETTER_AUTH_SECRET=(.+)$/m)?.[1] ?? "").trim();
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || (envFile.match(/^BETTER_AUTH_URL=(.+)$/m)?.[1] ?? "http://localhost:3000").trim();
const sql = neon(process.env.DATABASE_URL);

const { inviteMemberDb, activateMembershipsDb } = await import("@/db/queries/team");
const { auth } = await import("@/lib/auth/better-auth");

const ORG = "org_masizakhe";
const EMAIL = "invite.probe@example.com";
const NEW = "chosen-pass-9876";

async function cleanup() {
  const users = (await sql`SELECT id FROM "user" WHERE email=${EMAIL}`).map((r) => r.id);
  if (users.length) {
    await sql`DELETE FROM org_members WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM counsellors WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM account WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM session WHERE user_id = ANY(${users})`;
    await sql`DELETE FROM "user" WHERE id = ANY(${users})`;
  }
  await sql`DELETE FROM verification WHERE identifier LIKE ${"%" + EMAIL + "%"}`;
}
afterAll(cleanup);

describe("invited-member activation", () => {
  it("invites → sets a password → signs in → becomes active", { timeout: 30_000 }, async () => {
    await cleanup();

    const { userId, existing } = await inviteMemberDb(ORG, { name: "Invite Probe", email: EMAIL, teamRole: "front_desk" }, new Date().toISOString());
    expect(existing).toBe(false);

    // Provisioned: verified user + credential account + an invited membership.
    const [u] = await sql`SELECT email_verified FROM "user" WHERE id=${userId}`;
    expect(u!.email_verified).toBe(true);
    const [acct] = await sql`SELECT provider_id FROM account WHERE user_id=${userId}`;
    expect(acct!.provider_id).toBe("credential");
    const [m0] = await sql`SELECT status FROM org_members WHERE org_id=${ORG} AND user_id=${userId}`;
    expect(m0!.status).toBe("invited");

    // They can't sign in with an unknown password (the placeholder is unguessable).
    const guess = await auth.api.signInEmail({ body: { email: EMAIL, password: "placeholder" }, headers: new Headers() }).catch(() => null);
    expect(guess).toBeNull();

    // Set-password link → choose their own password.
    await auth.api.requestPasswordReset({ body: { email: EMAIL, redirectTo: "/reset-password" }, headers: new Headers() });
    const rows = await sql`SELECT identifier FROM verification WHERE identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 5`;
    const token = (rows[0]?.identifier as string | undefined)?.split("reset-password:")[1];
    expect(token).toBeTruthy();
    await auth.api.resetPassword({ body: { newPassword: NEW, token: token! }, headers: new Headers() });

    // Now sign-in works — and activation flips them to active.
    const ok = await auth.api.signInEmail({ body: { email: EMAIL, password: NEW }, headers: new Headers() }).catch(() => null);
    expect(ok).toBeTruthy();
    await activateMembershipsDb(userId);
    const [m1] = await sql`SELECT status FROM org_members WHERE org_id=${ORG} AND user_id=${userId}`;
    expect(m1!.status).toBe("active");
  });
});
