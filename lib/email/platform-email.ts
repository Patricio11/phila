import "server-only";
import { getResendCreds } from "@/lib/messaging/transports";

/**
 * Platform (Phila-branded) transactional email — verification, approval, etc. Uses
 * the super-admin's Resend credentials (admin/integrations), falling back to env.
 * Dormant-by-Default: when Resend isn't configured it returns an honest "dormant"
 * (never a fake "sent") and logs the intent so the flow is still testable in dev.
 */
export interface PlatformEmailResult {
  status: "sent" | "failed" | "dormant";
  detail?: string;
  id?: string;
}

export async function sendPlatformEmail(opts: { to: string; subject: string; html: string; text: string }): Promise<PlatformEmailResult> {
  const creds = await getResendCreds();
  if (!creds) {
    console.info(`[email:dormant] → ${opts.to} · ${opts.subject}`);
    return { status: "dormant", detail: "Resend not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Phila <${creds.from}>`, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
    });
    if (!res.ok) return { status: "failed", detail: `Resend HTTP ${res.status}` };
    const json = (await res.json()) as { id?: string };
    return { status: "sent", id: json.id };
  } catch (e) {
    return { status: "failed", detail: e instanceof Error ? e.message : "send error" };
  }
}
