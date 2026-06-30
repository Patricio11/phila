import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orgAiSettings, aiUsage, aiProviders } from "@/db/schema";
import { encryptField, decryptField } from "@/lib/crypto";

export type AiProviderKey = "openai" | "anthropic";

export interface AiProviderView {
  provider: AiProviderKey;
  model: string | null;
  enabled: boolean;
  hasKey: boolean;
}

/** All providers for the admin UI (never exposes the decrypted key). */
export async function getAiProviders(): Promise<AiProviderView[]> {
  const rows = await getDb().select().from(aiProviders);
  const view = (p: AiProviderKey): AiProviderView => {
    const r = rows.find((x) => x.provider === p);
    return { provider: p, model: r?.model ?? null, enabled: r?.enabled ?? false, hasKey: Boolean(r?.apiKeyEnc) };
  };
  return [view("anthropic"), view("openai")];
}

export async function saveAiProvider(provider: AiProviderKey, input: { apiKey?: string; model: string; enabled: boolean }): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(aiProviders).where(eq(aiProviders.provider, provider)).limit(1);
  const apiKeyEnc = input.apiKey ? encryptField(input.apiKey) : existing?.apiKeyEnc ?? null;
  const values = { provider, apiKeyEnc, model: input.model, enabled: input.enabled && Boolean(apiKeyEnc), updatedAt: new Date() };
  await db.insert(aiProviders).values(values).onConflictDoUpdate({ target: aiProviders.provider, set: { apiKeyEnc, model: values.model, enabled: values.enabled, updatedAt: values.updatedAt } });
}

/** Flip only the enabled flag (used to switch the other provider off). */
export async function setAiProviderEnabled(provider: AiProviderKey, enabled: boolean): Promise<void> {
  await getDb().update(aiProviders).set({ enabled, updatedAt: new Date() }).where(eq(aiProviders.provider, provider));
}

/** The active provider with the DECRYPTED key for the scribe (server-only). null = dormant. */
export async function getActiveProvider(): Promise<{ provider: AiProviderKey; apiKey: string; model: string } | null> {
  const rows = await getDb().select().from(aiProviders).where(eq(aiProviders.enabled, true));
  const pick = rows.find((r) => r.provider === "anthropic" && r.apiKeyEnc) ?? rows.find((r) => r.apiKeyEnc);
  if (!pick || !pick.apiKeyEnc) return null;
  return { provider: pick.provider as AiProviderKey, apiKey: decryptField(pick.apiKeyEnc), model: pick.model ?? defaultModel(pick.provider as AiProviderKey) };
}

export function defaultModel(provider: AiProviderKey): string {
  return provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o-mini";
}

export interface AiSettings {
  aiEnabled: boolean; // the POPIA cross-border consent gate
  monthlyCapCents: number;
}

const DEFAULT: AiSettings = { aiEnabled: false, monthlyCapCents: 100000 };

export async function getAiSettings(orgId: string): Promise<AiSettings> {
  const [row] = await getDb().select().from(orgAiSettings).where(eq(orgAiSettings.orgId, orgId)).limit(1);
  return row ? { aiEnabled: row.aiEnabled, monthlyCapCents: row.monthlyCapCents } : DEFAULT;
}

export async function saveAiSettings(orgId: string, s: AiSettings): Promise<void> {
  const values = { orgId, aiEnabled: s.aiEnabled, monthlyCapCents: s.monthlyCapCents, updatedAt: new Date() };
  await getDb().insert(orgAiSettings).values(values).onConflictDoUpdate({ target: orgAiSettings.orgId, set: { aiEnabled: s.aiEnabled, monthlyCapCents: s.monthlyCapCents, updatedAt: new Date() } });
}

/** Spend (in cents) for the current SAST calendar month. */
export async function getAiSpendThisMonth(orgId: string): Promise<number> {
  const monthStart = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit" }).format(new Date()) + "-01T00:00:00+02:00";
  const [row] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.orgId, orgId), gte(aiUsage.at, new Date(monthStart))));
  return row?.total ?? 0;
}

export async function recordAiUsage(input: { orgId: string; kind: "note" | "care_plan"; model: string; inputTokens: number; outputTokens: number; costCents: number }): Promise<void> {
  await getDb().insert(aiUsage).values({ ...input, at: new Date() });
}
