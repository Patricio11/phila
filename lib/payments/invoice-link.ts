import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, unguessable invoice pay-links (Phase 15B). The org shares /pay/<token>
 * with the client; the token is the invoice id + an HMAC, so it can't be forged or
 * enumerated. No new DB column needed.
 */
function secret(): string {
  return process.env.BETTER_AUTH_SECRET || process.env.PHILA_FIELD_KEY || "phila-dev-secret";
}

function sign(invoiceId: string): string {
  return createHmac("sha256", secret()).update(invoiceId).digest("base64url").slice(0, 24);
}

export function signInvoiceToken(invoiceId: string): string {
  return `${invoiceId}~${sign(invoiceId)}`;
}

export function verifyInvoiceToken(token: string): string | null {
  const i = token.lastIndexOf("~");
  if (i < 0) return null;
  const id = token.slice(0, i);
  const got = token.slice(i + 1);
  const want = sign(id);
  if (got.length !== want.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(got), Buffer.from(want))) return null;
  } catch {
    return null;
  }
  return id;
}

export function invoicePayPath(invoiceId: string): string {
  return `/pay/${signInvoiceToken(invoiceId)}`;
}
