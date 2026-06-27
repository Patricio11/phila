import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Field-level encryption (AES-256-GCM) for special-category fields — SA ID
 * numbers, and anything else we must store but never expose in the clear
 * (Care-Confidentiality Rule). Encryption exists from commit one; it is *wired*
 * for real fields in Phase 10. The envelope is `v1.<iv>.<tag>.<ciphertext>`,
 * all base64url, so the version and parameters travel with the data.
 *
 * The key comes from `PHILA_FIELD_KEY` (base64, 32 bytes), supplied by env/KMS.
 * In production a missing key is fatal — we never silently store plaintext.
 */
const ALGO = "aes-256-gcm";
const VERSION = "v1";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.PHILA_FIELD_KEY;
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32)
      throw new Error("PHILA_FIELD_KEY must decode to 32 bytes (base64).");
    cachedKey = key;
    return key;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("PHILA_FIELD_KEY is required in production — refusing to store plaintext.");

  // Dev-only ephemeral key: encryption is exercised, but nothing sensitive is
  // persisted in Part A. Regenerated per process, so it never leaks a stable key.
  cachedKey = randomBytes(32);
  return cachedKey;
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, b64url(iv), b64url(tag), b64url(ciphertext)].join(".");
}

export function decryptField(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION)
    throw new Error("Malformed or unsupported ciphertext envelope.");
  const iv = unb64url(parts[1]!);
  const tag = unb64url(parts[2]!);
  const ciphertext = unb64url(parts[3]!);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Mask a SA ID number for display (Redaction matrix): keep first 6, hide rest. */
export function maskIdNumber(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (digits.length < 7) return "•••••••";
  return `${digits.slice(0, 6)} •••• •••`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}
function unb64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}
