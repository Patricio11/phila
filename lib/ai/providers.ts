import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiProviderKey } from "@/db/queries/ai";

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** One call across providers. Both are asked to return a single JSON object. */
export async function complete(p: { provider: AiProviderKey; apiKey: string; model: string }, system: string, user: string): Promise<CompletionResult> {
  if (p.provider === "anthropic") {
    const client = new Anthropic({ apiKey: p.apiKey });
    const res = await client.messages.create({
      model: p.model,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  }
  const client = new OpenAI({ apiKey: p.apiKey });
  const res = await client.chat.completions.create({
    model: p.model,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_object" },
  });
  return { text: res.choices[0]?.message?.content ?? "", inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 };
}

// Rough ZAR cents per 1,000 tokens (for metering + the cap — not exact billing).
const RATES: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 6, out: 28 },
  "claude-haiku-4-5-20251001": { in: 2, out: 8 },
  "gpt-4o-mini": { in: 0.3, out: 1.2 },
  "gpt-4o": { in: 5, out: 20 },
};
export function costCents(model: string, inputTokens: number, outputTokens: number): number {
  const r = RATES[model] ?? { in: 6, out: 28 };
  return Math.ceil((inputTokens / 1000) * r.in + (outputTokens / 1000) * r.out);
}
