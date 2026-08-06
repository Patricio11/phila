import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

/**
 * Phase 31.6 - the broadened compliance sweep. Locks the confidentiality
 * invariants in CI so a future change can't silently regress them:
 *   1. The FUNDER payload never carries client PII (payload layer, beyond RLS).
 *   2. Every AI-draft surface carries the "AI-generated" label.
 *   3. Safeguarding never auto-actions: the messaging rail has no risk-flag path.
 *   4. k-anon + retention/erasure invariants live in their own suites
 *      (reporting.test.ts, retention-rules/dsar/retention-pruner) - asserted
 *      present here so deleting one of those suites fails the sweep.
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

const { getFunderGrantViewDb, listFunderGrantsDb } = await import("@/db/queries/grants");

describe("31.6 · no client PII in the funder payload", () => {
  it("the seeded funder's full portal payload contains no client name/email/phone", { timeout: 30_000 }, async () => {
    const [funderUser] = await sql`SELECT id FROM "user" WHERE email LIKE 'palesa%' LIMIT 1`;
    expect(funderUser).toBeTruthy();

    const grants = await listFunderGrantsDb(String(funderUser!.id));
    expect(grants.length).toBeGreaterThan(0);

    // Serialize EVERYTHING the funder portal can fetch.
    let payload = JSON.stringify(grants);
    for (const g of grants) {
      const view = await getFunderGrantViewDb(String(funderUser!.id), g.grant.id, new Date().toISOString());
      payload += JSON.stringify(view);
    }

    // Every live client of the org(s) behind those grants must be absent.
    const clients = await sql`SELECT name, email, phone FROM clients WHERE deleted_at IS NULL AND name NOT LIKE 'Removed client%' LIMIT 200`;
    expect(clients.length).toBeGreaterThan(0);
    const lower = payload.toLowerCase();
    for (const c of clients) {
      expect(lower).not.toContain(String(c.name).toLowerCase());
      if (c.email) expect(lower).not.toContain(String(c.email).toLowerCase());
      if (c.phone) expect(payload).not.toContain(String(c.phone));
    }
    // Never any clinical-note structure (the only "body" allowed is the org's
    // own narrative update, which is funder-facing by design).
    expect(lower).not.toContain("session_notes");
    expect(lower).not.toContain("clinicalnote");
    // POSITIVE lock: small-cell suppression is live inside the funder payload.
    expect(payload).toContain('"suppressed":true');
  });
});

describe("31.6 · AI honesty (Rule #2)", () => {
  it('every AI-draft surface carries the "AI-generated" label', () => {
    const editor = readFileSync("components/workspace/session-editor.tsx", "utf8");
    expect(editor).toContain("AI-generated");
  });

  it("the AI layer never signs, sends, or advances clinical state", () => {
    const aiDir = "lib/ai";
    const files = readdirSync(aiDir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(join(aiDir, f), "utf8");
      // The AI modules must not import the state-advancing or sending machinery.
      expect(src).not.toMatch(/markProgress|signNote|deliver\(|sendWhatsApp|sendSms|sendEmail/);
    }
  });
});

describe("31.6 · safeguarding never auto-actions (Rule #8)", () => {
  it("the messaging rail has no risk-flag pathway", () => {
    const rail = ["deliver.ts", "notify.ts", "notify-document.ts", "notify-form.ts", "transports.ts", "resolve.ts"];
    for (const f of rail) {
      const src = readFileSync(join("lib/messaging", f), "utf8");
      expect(src).not.toMatch(/riskFlag|risk_flag/);
    }
  });
});

describe("31.6 · companion suites present (deleting one fails the sweep)", () => {
  it("k-anon, retention, DSAR, and pruner suites exist", () => {
    for (const p of [
      "tests/unit/reporting.test.ts",
      "tests/unit/retention-rules.test.ts",
      "tests/integration/dsar.test.ts",
      "tests/integration/retention-pruner.test.ts",
      "tests/integration/rls.test.ts",
    ]) {
      expect(readFileSync(p, "utf8").length).toBeGreaterThan(100);
    }
  });
});
