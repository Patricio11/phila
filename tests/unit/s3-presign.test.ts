import { describe, it, expect } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { s3Storage } from "@/lib/storage/s3";

/**
 * Batch 2o - S3 presigning. The browser PUTs straight to the bucket with a URL
 * we sign here, so the signature has to be right and the credential must never
 * be the thing that travels. These are pure checks (no network, no AWS).
 */
const CFG = {
  region: "af-south-1",
  bucket: "phila-documents",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

const store = s3Storage(CFG);

describe("S3 presigned URLs", () => {
  it("addresses the bucket in its own region, virtual-hosted style", async () => {
    const url = new URL(await store.signedDownloadUrl("org_a/doc_1/report.pdf", 300));
    expect(url.host).toBe("phila-documents.s3.af-south-1.amazonaws.com");
    expect(url.pathname).toBe("/org_a/doc_1/report.pdf");
    expect(url.protocol).toBe("https:");
  });

  it("carries every SigV4 query parameter, and no credential secret", async () => {
    const url = new URL(await store.signedDownloadUrl("org_a/doc_1/report.pdf", 900));
    const q = url.searchParams;
    expect(q.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(q.get("X-Amz-Credential")).toMatch(/^AKIAIOSFODNN7EXAMPLE\/\d{8}\/af-south-1\/s3\/aws4_request$/);
    expect(q.get("X-Amz-Date")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(q.get("X-Amz-Expires")).toBe("900");
    expect(q.get("X-Amz-SignedHeaders")).toBe("host");
    expect(q.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    // The secret itself never appears anywhere in the URL.
    expect(url.toString()).not.toContain(CFG.secretAccessKey);
  });

  it("signs the canonical request AWS specifies", async () => {
    const key = "org_a/doc_1/report.pdf";
    const url = new URL(await store.signedDownloadUrl(key, 300));
    const q = url.searchParams;
    const amzDate = q.get("X-Amz-Date")!;
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/af-south-1/s3/aws4_request`;

    // Recompute independently, straight from the spec.
    const canonicalQuery = [
      ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
      ["X-Amz-Credential", `${CFG.accessKeyId}/${scope}`],
      ["X-Amz-Date", amzDate],
      ["X-Amz-Expires", "300"],
      ["X-Amz-SignedHeaders", "host"],
    ]
      .map(([k, v]) => `${encodeURIComponent(k!)}=${encodeURIComponent(v!)}`)
      .sort()
      .join("&");
    const canonicalRequest = [
      "GET",
      `/${key}`,
      canonicalQuery,
      `host:${url.host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
    ].join("\n");
    const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d, "utf8").digest();
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${CFG.secretAccessKey}`, dateStamp), CFG.region), "s3"), "aws4_request");
    const expected = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    expect(q.get("X-Amz-Signature")).toBe(expected);
  });

  it("gives a different signature for a different method, key, or lifetime", async () => {
    const get = new URL(await store.signedDownloadUrl("a/b.png", 300)).searchParams.get("X-Amz-Signature");
    const put = new URL((await store.signedUploadUrl({ key: "a/b.png", contentType: "image/png" })).uploadUrl).searchParams.get("X-Amz-Signature");
    const other = new URL(await store.signedDownloadUrl("a/c.png", 300)).searchParams.get("X-Amz-Signature");
    const longer = new URL(await store.signedDownloadUrl("a/b.png", 3600)).searchParams.get("X-Amz-Signature");
    expect(new Set([get, put, other, longer]).size).toBe(4);
  });

  it("keeps path separators but escapes the rest of a key", async () => {
    const url = new URL(await store.signedDownloadUrl("org a/why not.pdf", 60));
    expect(url.pathname).toBe("/org%20a/why%20not.pdf");
  });

  it("uploads expire quickly - a presigned PUT is not a standing permission", async () => {
    const { uploadUrl, key } = await store.signedUploadUrl({ key: "org_a/doc_2/scan.jpg", contentType: "image/jpeg" });
    expect(key).toBe("org_a/doc_2/scan.jpg");
    expect(new URL(uploadUrl).searchParams.get("X-Amz-Expires")).toBe("300");
  });

  it("uses path style against an S3-compatible endpoint", async () => {
    const compat = s3Storage({ ...CFG, endpoint: "https://minio.internal:9000" });
    const url = new URL(await compat.signedDownloadUrl("org_a/doc_1/report.pdf", 60));
    expect(url.host).toBe("minio.internal:9000");
    expect(url.pathname).toBe("/phila-documents/org_a/doc_1/report.pdf");
  });
});
