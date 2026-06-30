"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { saveAiProvider, setAiProviderEnabled } from "@/db/queries/ai";

/**
 * Super-admin configures the platform AI providers (OpenAI / Claude) and switches
 * one on (Phase 14). Keys are encrypted at rest. Enabling one switches the other
 * off — a single active provider powers the scribe for every org.
 */
const input = z.object({
  provider: z.enum(["openai", "anthropic"]),
  apiKey: z.string().trim().default(""),
  model: z.string().trim().min(2, "Enter a model id.").max(80),
  enabled: z.boolean(),
});

export async function saveAiProviderConfig(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const principal = await requireSuperAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the provider details." };
  const d = parsed.data;

  await saveAiProvider(d.provider, { apiKey: d.apiKey || undefined, model: d.model, enabled: d.enabled });
  // One active provider: enabling one switches the other off.
  if (d.enabled) {
    await setAiProviderEnabled(d.provider === "anthropic" ? "openai" : "anthropic", false);
  }
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null }, orgId: null, target: `ai_provider:${d.provider}`, reason: d.enabled ? `enable_${d.provider}` : `disable_${d.provider}` });
  return { ok: true };
}
