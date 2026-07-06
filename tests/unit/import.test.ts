import { describe, it, expect } from "vitest";
import { CLIENT_IMPORT_FIELDS } from "@/lib/import/schema";
import { parseCsv, parseXlsx, type ParsedFile } from "@/lib/import/parse";
import { autoMap } from "@/lib/import/automap";
import { buildRows, normalizePhone, normalizeEmail, matchEnum, phoneKey } from "@/lib/import/validate";

const FIELDS = CLIENT_IMPORT_FIELDS;

describe("parseCsv", () => {
  it("splits headers + rows, honours quotes, embedded commas, and escaped quotes", () => {
    const csv = 'Name,Phone,Notes\n"Nkosi, Thandiwe",082 123 4567,"Said ""hi"""\nSipho,071 555 0192,ok';
    const p = parseCsv(csv);
    expect(p.headers).toEqual(["Name", "Phone", "Notes"]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toEqual(["Nkosi, Thandiwe", "082 123 4567", 'Said "hi"']);
  });

  it("strips a BOM and auto-detects a semicolon delimiter", () => {
    const p = parseCsv("﻿Name;Email\nLerato;lerato@example.co.za");
    expect(p.headers).toEqual(["Name", "Email"]);
    expect(p.rows[0]).toEqual(["Lerato", "lerato@example.co.za"]);
  });

  it("ignores fully-blank trailing rows", () => {
    const p = parseCsv("Name,Phone\nA,1\n\n , \n");
    expect(p.rows).toHaveLength(1);
  });
});

describe("autoMap", () => {
  it("maps by header name", () => {
    const p: ParsedFile = { headers: ["Full name", "Mobile", "E-mail", "Province"], rows: [["A", "0821234567", "a@b.co", "Gauteng"]], fileName: "f" };
    const m = autoMap(FIELDS, p);
    expect(m).toEqual({ name: 0, phone: 1, email: 2, province: 3 });
  });

  it("falls back to data shape when headers are unhelpful (email under 'Contact')", () => {
    const p: ParsedFile = {
      headers: ["Client", "Contact", "Number"],
      rows: [
        ["Lerato Mahlangu", "lerato@example.co.za", "082 123 4567"],
        ["Sipho Khumalo", "sipho@example.co.za", "071 555 0192"],
      ],
      fileName: "f",
    };
    const m = autoMap(FIELDS, p);
    expect(m.name).toBe(0);
    expect(m.email).toBe(1); // detected by shape, not header
    expect(m.phone).toBe(2);
  });

  it("never maps two fields to the same column", () => {
    const p: ParsedFile = { headers: ["name", "name2"], rows: [["A", "B"]], fileName: "f" };
    const m = autoMap(FIELDS, p);
    const cols = Object.values(m).filter((v) => v != null);
    expect(new Set(cols).size).toBe(cols.length);
  });
});

describe("normalizers", () => {
  it("normalizes SA phone formats or rejects unreadable ones", () => {
    expect(normalizePhone("082 123 4567")).toBe("0821234567");
    expect(normalizePhone("+27 82 123 4567")).toBe("+27821234567");
    expect(normalizePhone("27821234567")).toBe("+27821234567");
    expect(normalizePhone("821234567")).toBe("0821234567");
    expect(normalizePhone("12")).toBeNull();
  });
  it("validates + lowercases email", () => {
    expect(normalizeEmail("Lerato@Example.CO.ZA")).toBe("lerato@example.co.za");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
  it("matches province by value or alias", () => {
    const province = FIELDS.find((f) => f.key === "province")!;
    expect(matchEnum("gauteng", province)).toBe("Gauteng");
    expect(matchEnum("GP", province)).toBe("Gauteng");
    expect(matchEnum("kzn", province)).toBe("KwaZulu-Natal");
    expect(matchEnum("Narnia", province)).toBeNull();
  });
  it("dedupe phone key is stable across 0…/+27…/27…", () => {
    expect(phoneKey("0821234567")).toBe(phoneKey("+27821234567"));
    expect(phoneKey("0821234567")).toBe(phoneKey("27821234567"));
  });
});

describe("buildRows", () => {
  const parse = (csv: string) => parseCsv(csv);
  const map = (p: ParsedFile) => autoMap(FIELDS, p);

  it("builds clean rows, applies aliases, and normalizes contacts", () => {
    const p = parse("Name,Phone,Email,Province\nLerato Mahlangu,082 123 4567,LERATO@ex.co.za,GP");
    const res = buildRows(FIELDS, p, map(p), new Set());
    expect(res.ready).toEqual([{ name: "Lerato Mahlangu", phone: "0821234567", email: "lerato@ex.co.za", province: "Gauteng" }]);
  });

  it("de-dupes within the file and against existing clients", () => {
    const p = parse("Name,Phone\nAnna,0821234567\nBongi,082 123 4567\nCandice,0839999999");
    const existing = new Set([phoneKey("0839999999")!]);
    const res = buildRows(FIELDS, p, map(p), existing);
    expect(res.ready.map((r) => r.name)).toEqual(["Anna"]); // Bongi dups Anna; Candice already exists
    expect(res.duplicates).toBe(2);
  });

  it("sets aside a row missing the required name (never silently dropped)", () => {
    const p = parse("Name,Phone\nValid Name,0821234567\n,0820000000");
    const res = buildRows(FIELDS, p, map(p), new Set());
    expect(res.ready).toHaveLength(1);
    expect(res.attention).toHaveLength(1);
    expect(res.attention[0]!.reason).toBe("Missing name");
  });
});

describe("parseXlsx round-trip", () => {
  it("reads headers + rows from a real .xlsx", { timeout: 30_000 }, async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Clients");
    ws.addRow(["Name", "Phone", "Province"]);
    ws.addRow(["Naledi Tshabalala", "0824445566", "Limpopo"]);
    const buf = await wb.xlsx.writeBuffer();
    const file = { name: "clients.xlsx", arrayBuffer: async () => buf } as unknown as File;
    const p = await parseXlsx(file);
    expect(p.headers).toEqual(["Name", "Phone", "Province"]);
    expect(p.rows[0]).toEqual(["Naledi Tshabalala", "0824445566", "Limpopo"]);
  });
});
