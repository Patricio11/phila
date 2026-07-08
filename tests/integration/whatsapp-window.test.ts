import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { whatsappWindowOpen } from "@/lib/messaging/whatsapp-window";

/**
 * WhatsApp 24h window — the webhook records every inbound message; deliver reads it
 * back to choose free-form (in-window) vs template (out-of-window). Proves the
 * canonical phone key matches an inbound wa_id to the stored (spaced) client phone,
 * and that the upsert keeps the latest inbound time.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { recordWhatsappInbound, getWhatsappLastInbound } = await import("@/db/queries/messaging");

const ORG = "org_wa_win_probe";

afterAll(async () => {
  await sql`DELETE FROM whatsapp_windows WHERE org_id=${ORG}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("whatsapp window record/read", () => {
  it("matches an inbound wa_id to a spaced client phone, upserts latest, and drives the open/closed decision", { timeout: 20_000 }, async () => {
    await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, created_at)
      VALUES (${ORG}, 'WA Window Probe', 'wa-win-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now()) ON CONFLICT (id) DO NOTHING`;
    await sql`DELETE FROM whatsapp_windows WHERE org_id=${ORG}`;

    const now = new Date();
    const stale = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30h ago
    const fresh = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago

    // Webhook stores the raw wa_id form "+27825551234"; the client's phone is spaced.
    await recordWhatsappInbound(ORG, "+27825551234", stale);
    // A later inbound refreshes the same key (upsert wins).
    await recordWhatsappInbound(ORG, "+27825551234", fresh);

    // deliver reads by the stored (spaced) client phone — same canonical key.
    const at = await getWhatsappLastInbound(ORG, "+27 82 555 1234");
    expect(at).not.toBeNull();
    expect(at!.getTime()).toBe(fresh.getTime());
    expect(whatsappWindowOpen(at, now)).toBe(true);

    // A different client who last messaged 30h ago → window closed.
    await recordWhatsappInbound(ORG, "+27 83 000 1111", stale);
    const other = await getWhatsappLastInbound(ORG, "+27830001111");
    expect(whatsappWindowOpen(other, now)).toBe(false);

    // Only two distinct phone keys stored.
    const rows = await sql`SELECT count(*)::int AS n FROM whatsapp_windows WHERE org_id=${ORG}`;
    expect(rows[0]!.n).toBe(2);
  });
});
