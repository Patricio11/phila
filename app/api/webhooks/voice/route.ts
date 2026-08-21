import { NextResponse } from "next/server";
import { getSwitchboard, adapterForProvider, mockAdapter } from "@/lib/voice";
import { settleVoiceLeg } from "@/lib/voice/settle";

export const dynamic = "force-dynamic";

/**
 * Phase 33.3/33.5 → 33.9 - the Twilio (and mock) status webhook. Signature-
 * verified against the TWILIO credentials specifically - not "the active
 * provider" - so in-flight Twilio legs keep settling correctly after a
 * provider switch (33.9: a switch applies to new calls only). Africa's
 * Talking has its own door (`/api/webhooks/voice-at/[token]`). Unknown legs
 * are acknowledged and ignored - we only trust calls we placed.
 */
export async function POST(req: Request) {
  const sb = await getSwitchboard();
  // Twilio's door stays open as long as Twilio is CONFIGURED (its legs may
  // still be in flight), even when another provider is active.
  if (!sb.twilio.accountSid && !sb.twilio.authToken && sb.active !== "mock") {
    return NextResponse.json({ ok: true, ignored: "twilio not configured" });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false }, { status: 400 });
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const isMockLeg = (params.CallSid ?? "").startsWith("mock_");
  const adapter = isMockLeg ? mockAdapter(sb) : adapterForProvider(sb, "twilio");
  const parsed = adapter.parseWebhook({
    url: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/api/webhooks/voice`,
    params,
    signature: req.headers.get("x-twilio-signature"),
  });
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 403 });

  const res = await settleVoiceLeg(parsed);
  return NextResponse.json(res);
}
