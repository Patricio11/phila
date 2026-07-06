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
  it("accepts a token produced by signJoin and rejects tampering", () => {
    const id = "appt_probe_123";
    const sig = signJoin(id);
    expect(verifyJoin(id, sig)).toBe(true);
    expect(verifyJoin(id, sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(verifyJoin("appt_other", sig)).toBe(false);
    expect(verifyJoin(id, null)).toBe(false);
    expect(verifyJoin(id, "short")).toBe(false);
  });
});
