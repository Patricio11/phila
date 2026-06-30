import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 14 — AI scribe plumbing (no paid model calls). Verifies the platform
 * provider config (encrypted key, single active, decrypt for the scribe), the
 * dormant path, the org consent gate + spend cap, and cost metering.
 */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
process.env.PHILA_FIELD_KEY = env.match(/^PHILA_FIELD_KEY=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

import { getAiProviders, saveAiProvider, setAiProviderEnabled, getActiveProvider, getAiSettings, saveAiSettings, getAiSpendThisMonth, recordAiUsage } from "@/db/queries/ai";
import { draftNote } from "@/lib/ai/scribe";
import { costCents } from "@/lib/ai/providers";

const ORG = "org_masizakhe";

beforeEach(async () => {
  await sql`DELETE FROM ai_providers`;
  await sql`DELETE FROM ai_usage WHERE org_id=${ORG}`;
  await sql`DELETE FROM org_ai_settings WHERE org_id=${ORG}`;
});
afterAll(async () => {
  await sql`DELETE FROM ai_providers`;
  await sql`DELETE FROM ai_usage WHERE org_id=${ORG}`;
  await sql`DELETE FROM org_ai_settings WHERE org_id=${ORG}`;
});

describe("AI provider config", () => {
  it("stores the key encrypted and returns it decrypted only to the scribe", async () => {
    await saveAiProvider("anthropic", { apiKey: "sk-secret-123", model: "claude-sonnet-4-6", enabled: true });
    const [row] = await sql`SELECT api_key_enc FROM ai_providers WHERE provider='anthropic'`;
    expect(String(row!.api_key_enc)).not.toContain("sk-secret-123"); // encrypted at rest

    const active = await getActiveProvider();
    expect(active?.provider).toBe("anthropic");
    expect(active?.apiKey).toBe("sk-secret-123"); // decrypted for the scribe only
    expect(active?.model).toBe("claude-sonnet-4-6");

    const view = await getAiProviders();
    expect(view.find((p) => p.provider === "anthropic")).toMatchObject({ enabled: true, hasKey: true });
  });

  it("keeps a single active provider (switching one off)", async () => {
    await saveAiProvider("anthropic", { apiKey: "a", model: "claude-sonnet-4-6", enabled: true });
    await saveAiProvider("openai", { apiKey: "b", model: "gpt-4o-mini", enabled: false });
    await setAiProviderEnabled("anthropic", false);
    expect(await getActiveProvider()).toBeNull(); // none enabled → dormant
  });
});

describe("scribe gate", () => {
  it("is dormant when no provider is switched on", async () => {
    const res = await draftNote({ cues: "explored work stress", clientNames: ["Lerato"] });
    expect(res.ok).toBe(false);
    expect(res.dormant).toBe(true);
  });

  it("org consent gate is OFF by default", async () => {
    expect((await getAiSettings(ORG)).aiEnabled).toBe(false);
    await saveAiSettings(ORG, { aiEnabled: true, monthlyCapCents: 50000 });
    expect((await getAiSettings(ORG)).aiEnabled).toBe(true);
  });

  it("meters spend toward the monthly cap", async () => {
    expect(await getAiSpendThisMonth(ORG)).toBe(0);
    await recordAiUsage({ orgId: ORG, kind: "note", model: "claude-sonnet-4-6", inputTokens: 1000, outputTokens: 500, costCents: 20 });
    await recordAiUsage({ orgId: ORG, kind: "care_plan", model: "claude-sonnet-4-6", inputTokens: 500, outputTokens: 200, costCents: 11 });
    expect(await getAiSpendThisMonth(ORG)).toBe(31);
  });
});

describe("cost metering", () => {
  it("computes a non-zero cost from tokens", () => {
    expect(costCents("claude-sonnet-4-6", 2000, 1000)).toBeGreaterThan(0);
    expect(costCents("gpt-4o-mini", 1000, 1000)).toBeGreaterThanOrEqual(1);
  });
});
