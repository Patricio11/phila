import { describe, it, expect } from "vitest";
import { validateUpload, sizeLabel, MAX_FILE_BYTES } from "@/lib/documents/quota";

describe("upload validation (Phase 18)", () => {
  it("accepts an allowed type within the size cap", () => {
    expect(validateUpload({ contentType: "application/pdf", bytes: 1024 })).toEqual({ ok: true });
  });

  it("rejects a disallowed content type", () => {
    const r = validateUpload({ contentType: "application/x-msdownload", bytes: 1024 });
    expect(r.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(validateUpload({ contentType: "application/pdf", bytes: 0 }).ok).toBe(false);
  });

  it("rejects a file over the per-file cap", () => {
    expect(validateUpload({ contentType: "application/pdf", bytes: MAX_FILE_BYTES + 1 }).ok).toBe(false);
  });
});

describe("sizeLabel", () => {
  it("formats bytes calmly and shows  for empty", () => {
    expect(sizeLabel(0)).toBe("");
    expect(sizeLabel(512)).toBe("512 B");
    expect(sizeLabel(2 * 1024 * 1024)).toBe("2 MB");
  });
});
