import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/** Phase 17.2 — in-app notifications: create → list → unread → mark read; and the
 * counsellor resolver. No external services; always-on. */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

import { createNotification, listNotifications, unreadNotificationCount, markNotificationsRead, notifyCounsellor } from "@/db/queries/notifications";

const U = "user_test_notif_p172";

afterAll(async () => {
  await sql`DELETE FROM notifications WHERE user_id = ${U} OR kind = 'test_p172'`;
});

describe("in-app notifications", () => {
  it("creates, lists, counts unread, and marks read", async () => {
    await sql`DELETE FROM notifications WHERE user_id = ${U}`;
    await createNotification({ userId: U, kind: "test_p172", title: "Session booked", body: "Wed at 10:00", href: "/app/sessions/x" });
    await createNotification({ userId: U, kind: "test_p172", title: "Another", body: null, href: null });

    const items = await listNotifications(U);
    expect(items.length).toBe(2);
    expect(items[0]!.unread).toBe(true);
    expect(await unreadNotificationCount(U)).toBe(2);

    await markNotificationsRead(U);
    expect(await unreadNotificationCount(U)).toBe(0);
    expect((await listNotifications(U))[0]!.unread).toBe(false);
  });

  it("resolves a counsellor to their user and notifies them", async () => {
    const [c] = await sql`SELECT user_id FROM counsellors WHERE id = 'couns_nomsa' LIMIT 1`;
    if (!c) return; // seed variant without this counsellor
    await sql`DELETE FROM notifications WHERE user_id = ${c.user_id} AND kind = 'test_p172'`;
    await notifyCounsellor("couns_nomsa", { kind: "test_p172", title: "New session", body: "with a client", href: "/app/sessions/y" });
    const [row] = await sql`SELECT count(*)::int n FROM notifications WHERE user_id = ${c.user_id} AND kind = 'test_p172'`;
    expect(row!.n).toBe(1);
  });
});
