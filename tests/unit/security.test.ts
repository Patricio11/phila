import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { validateUpload } from "@/lib/documents/quota";
import { paystackSignatureValid } from "@/lib/payments/paystack";
import { signJoin, verifyJoin } from "@/lib/video/livekit";

/**
 * W2 hardening — the pure security primitives: upload type/extension validation,
 * constant-time Paystack webhook signature check, and video join-token verification.
 */
describe("validateUpload", () => {
  it("accepts a supported type with a matching extension", () => {
    expect(validateUpload({ contentType: "application/pdf", bytes: 1000, name: "cert.pdf" })).toEqual({ ok: true });
    expect(validateUpload({ contentType: "image/jpeg", bytes: 1000, name: "scan.JPG" })).toEqual({ ok: true });
  });
  it("rejects an extension that doesn't match the declared type", () => {
    const r = validateUpload({ contentType: "application/pdf", bytes: 1000, name: "sneaky.exe" });
    expect(r.ok).toBe(false);
  });
  it("still rejects an unsupported type and oversize/empty files", () => {
    expect(validateUpload({ contentType: "application/x-msdownload", bytes: 10, name: "x.exe" }).ok).toBe(false);
    expect(validateUpload({ contentType: "application/pdf", bytes: 0, name: "x.pdf" }).ok).toBe(false);
    expect(validateUpload({ contentType: "application/pdf", bytes: 999_000_000, name: "x.pdf" }).ok).toBe(false);
  });
  it("skips the extension check when no name is given (back-compat)", () => {
    expect(validateUpload({ contentType: "application/pdf", bytes: 1000 })).toEqual({ ok: true });
  });
});

describe("paystackSignatureValid", () => {
  const key = "sk_test_probe";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });
  const good = createHmac("sha512", key).update(body).digest("hex");

  it("accepts a correct HMAC-SHA512 signature", () => {
    expect(paystackSignatureValid(key, body, good)).toBe(true);
  });
  it("rejects a tampered / wrong-length / missing signature", () => {
    expect(paystackSignatureValid(key, body, good.slice(0, -1) + "0")).toBe(false);
    expect(paystackSignatureValid(key, body, "deadbeef")).toBe(false);
    expect(paystackSignatureValid(key, body, null)).toBe(false);
    expect(paystackSignatureValid("", body, good)).toBe(false);
  });
});

describe("verifyJoin", () => {
  const id = "appt_probe_123";
  const start = new Date("2027-05-01T10:00:00+02:00").toISOString();
  const atStart = new Date(start).getTime();

  it("accepts a token in-window and rejects tampering / wrong appointment", () => {
    const sig = signJoin(id, start);
    expect(verifyJoin(id, start, sig, atStart)).toBe(true);
    expect(verifyJoin(id, start, sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A"), atStart)).toBe(false);
    expect(verifyJoin("appt_other", start, sig, atStart)).toBe(false);
    expect(verifyJoin(id, start, null, atStart)).toBe(false);
    expect(verifyJoin(id, start, "short", atStart)).toBe(false);
  });

  it("enforces the time window (nonce: a rescheduled start invalidates old links)", () => {
    const sig = signJoin(id, start);
    // Too early / too late.
    expect(verifyJoin(id, start, sig, atStart - 60 * 60_000)).toBe(false);
    expect(verifyJoin(id, start, sig, atStart + 4 * 60 * 60_000)).toBe(false);
    // A link signed for the OLD time doesn't verify against a rescheduled time.
    const moved = new Date(atStart + 86_400_000).toISOString();
    expect(verifyJoin(id, moved, sig, new Date(moved).getTime())).toBe(false);
  });
});
