import { describe, it, expect } from "vitest";
import { objectKey } from "@/lib/storage/types";

describe("storage object keys (Phase 18)", () => {
  it("namespaces by org + document id and keeps a safe label", () => {
    expect(objectKey("org_x", "doc_1", "My Report 2024.pdf")).toBe("org_x/doc_1/my-report-2024.pdf");
  });

  it("strips unsafe characters and collapses separators", () => {
    expect(objectKey("o", "d", "a/b\\c:*?.txt")).toBe("o/d/a-b-c-.txt");
  });

  it("falls back to 'file' for an empty/odd name", () => {
    expect(objectKey("o", "d", "***")).toBe("o/d/file");
  });

  it("caps the label length", () => {
    const key = objectKey("o", "d", "x".repeat(200) + ".pdf");
    expect(key.startsWith("o/d/")).toBe(true);
    expect(key.length).toBeLessThanOrEqual(4 + 80);
  });
});
