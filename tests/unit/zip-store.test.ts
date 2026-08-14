import { describe, expect, it } from "vitest";
import { buildZip, crc32, zipEntryName } from "@/lib/zip/store";

const text = (s: string) => new TextEncoder().encode(s);
const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at, true);
const u16 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint16(at, true);

describe("crc32 (batch 3p)", () => {
  it("matches known vectors", () => {
    expect(crc32(text(""))).toBe(0);
    expect(crc32(text("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
  });
});

describe("buildZip (batch 3p)", () => {
  const now = new Date(2026, 7, 14, 12, 0, 0);

  it("writes a structurally valid single-entry archive", () => {
    const data = text("hello phila");
    const zip = buildZip([{ name: "note.txt", data }], now);

    // Local file header at 0.
    expect(u32(zip, 0)).toBe(0x04034b50);
    expect(u16(zip, 8)).toBe(0); // stored
    expect(u32(zip, 14)).toBe(crc32(data));
    expect(u32(zip, 18)).toBe(data.length);
    // Central directory follows the local record.
    const centralAt = 30 + "note.txt".length + data.length;
    expect(u32(zip, centralAt)).toBe(0x02014b50);
    expect(u32(zip, centralAt + 42)).toBe(0); // first local header offset
    // EOCD is the last 22 bytes.
    const eocd = zip.slice(zip.length - 22);
    expect(u32(eocd, 0)).toBe(0x06054b50);
    expect(u16(eocd, 8)).toBe(1);
    expect(u32(eocd, 16)).toBe(centralAt);
  });

  it("offsets stack correctly across entries and bytes round-trip", () => {
    const a = text("first file");
    const b = text("second, longer file content");
    const zip = buildZip([{ name: "a.txt", data: a }, { name: "b.txt", data: b }], now);

    const firstLocal = 30 + 5 + a.length;
    expect(u32(zip, firstLocal)).toBe(0x04034b50); // second local header right after
    // The stored bytes are readable exactly where the headers say.
    expect(new TextDecoder().decode(zip.slice(30 + 5, 30 + 5 + a.length))).toBe("first file");
    expect(new TextDecoder().decode(zip.slice(firstLocal + 30 + 5, firstLocal + 30 + 5 + b.length))).toBe("second, longer file content");
    const eocd = zip.slice(zip.length - 22);
    expect(u16(eocd, 8)).toBe(2);
  });
});

describe("zipEntryName (batch 3p)", () => {
  it("sanitises path-hostile characters and de-duplicates", () => {
    const taken = new Set<string>();
    expect(zipEntryName("Intake form.pdf", taken)).toBe("Intake form.pdf");
    expect(zipEntryName("Intake form.pdf", taken)).toBe("Intake form (2).pdf");
    expect(zipEntryName("Intake form.pdf", taken)).toBe("Intake form (3).pdf");
    expect(zipEntryName("a/b\\c:d.txt", taken)).toBe("a_b_c_d.txt");
    expect(zipEntryName("", taken)).toBe("file");
  });
});
