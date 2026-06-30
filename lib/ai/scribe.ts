import "server-only";
import { getActiveProvider } from "@/db/queries/ai";
import { deidentify } from "@/lib/ai/deidentify";
import { complete, costCents } from "@/lib/ai/providers";

export interface Extraction {
  presentingIssue: string;
  risk: string;
  outcome: string;
  referral: string;
}
export interface ScribeResult {
  ok: boolean;
  dormant?: boolean;
  error?: string;
  draft?: string;
  extraction?: Extraction;
  carePlan?: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number; costCents: number };
}

const NOTE_SYSTEM = `You are a clinical documentation assistant for a South African counselling practice.
From a counsellor's rough session cues, write a concise, professional progress note and extract structured fields.
Rules:
- Write about "the client"  never use names (the cues are de-identified).
- Be factual and non-diagnostic. Do NOT invent details, diagnoses, or a therapeutic method that the cues don't state.
- Plain, respectful, South African English.
Return ONLY a JSON object: {"draft": "<the note>", "presentingIssue": "<short>", "risk": "<short, e.g. None raised today>", "outcome": "<short>", "referral": "<short or None>"}.`;

const CARE_PLAN_SYSTEM = `You are helping a South African counsellor write a short, warm, plain-language summary FOR THE CLIENT to read (not a clinical note).
From the cues, write 2–4 encouraging sentences the client can understand: what we focused on and a gentle next step. No jargon, no diagnosis, never alarming.
Write about "you" (addressing the client). Return ONLY a JSON object: {"carePlan": "<the message>"}.`;

function parseJson(text: string): Record<string, string> {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, string>;
  } catch {
    return { draft: text.trim(), carePlan: text.trim() };
  }
}

async function run(system: string, user: string): Promise<{ res: Awaited<ReturnType<typeof complete>>; provider: NonNullable<Awaited<ReturnType<typeof getActiveProvider>>> } | { dormant: true }> {
  const provider = await getActiveProvider();
  if (!provider) return { dormant: true };
  const res = await complete(provider, system, user);
  return { res, provider };
}

/** Draft a private clinical note + structured M&E extraction from de-identified cues. */
export async function draftNote(opts: { cues: string; clientNames: string[] }): Promise<ScribeResult> {
  try {
    const out = await run(NOTE_SYSTEM, `Session cues:\n${deidentify(opts.cues, opts.clientNames)}\n\nReturn only the JSON.`);
    if ("dormant" in out) return { ok: false, dormant: true, error: "The AI scribe isn't switched on yet." };
    const p = parseJson(out.res.text);
    return {
      ok: true,
      draft: p.draft ?? "",
      extraction: { presentingIssue: p.presentingIssue ?? "", risk: p.risk ?? "", outcome: p.outcome ?? "", referral: p.referral ?? "None" },
      model: out.provider.model,
      usage: { inputTokens: out.res.inputTokens, outputTokens: out.res.outputTokens, costCents: costCents(out.provider.model, out.res.inputTokens, out.res.outputTokens) },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI draft failed" };
  }
}

/** Draft a client-facing, plain-language care-plan summary (separate from the private note). */
export async function draftCarePlan(opts: { cues: string; clientNames: string[] }): Promise<ScribeResult> {
  try {
    const out = await run(CARE_PLAN_SYSTEM, `Session cues:\n${deidentify(opts.cues, opts.clientNames)}\n\nReturn only the JSON.`);
    if ("dormant" in out) return { ok: false, dormant: true, error: "The AI scribe isn't switched on yet." };
    const p = parseJson(out.res.text);
    return {
      ok: true,
      carePlan: p.carePlan ?? p.draft ?? "",
      model: out.provider.model,
      usage: { inputTokens: out.res.inputTokens, outputTokens: out.res.outputTokens, costCents: costCents(out.provider.model, out.res.inputTokens, out.res.outputTokens) },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI draft failed" };
  }
}
