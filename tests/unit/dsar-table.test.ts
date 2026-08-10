import { describe, it, expect } from "vitest";
import { dsarExportTable, humanField, cellValue } from "@/lib/export/dsar-table";

/**
 * Batch 2q - the POPIA export now goes out as CSV / Excel / PDF through the
 * shared Export menu. It is what a practice hands someone who asks what is
 * held about them, so the flattening must not lose a single field.
 */
const SAMPLE = {
  generatedAt: "2026-08-10T09:00:00.000Z",
  organisation: { id: "org_masizakhe", name: "Masizakhe Counselling" },
  client: { id: "cl_1", name: "Sipho Khumalo", phone: "+27831112222", homeLanguage: "zu-ZA", riskFlag: true, profile: { dateOfBirth: "1990-04-02" } },
  demographics: { province: "Gauteng", employment: "employed" },
  carePlan: null,
  appointments: [
    { id: "a1", startsAt: "2026-08-12T08:00:00.000Z", serviceName: "Individual counselling", state: "completed", durationMin: 60 },
    { id: "a2", startsAt: "2026-08-19T08:00:00.000Z", serviceName: "Individual counselling", state: "scheduled", durationMin: 60 },
  ],
  clinicalNotes: [{ id: "n1", signedAt: "2026-08-12T09:00:00.000Z", authorName: "Nomsa Dlamini" }],
  outcomes: [{ measure: "PHQ-9", score: 12, at: "2026-08-12" }],
  consents: [{ purpose: "care", state: "granted", at: "2026-01-04" }],
  documents: [{ name: "intake.pdf", bytes: 4096 }],
  invoices: [{ number: "INV-0007", amountCents: 45000, status: "paid" }],
  accessAudit: [{ at: "2026-08-12T10:00:00.000Z", actorName: "Thandeka Mbeki", action: "pii.read", reason: "hub_oversight" }],
  retention: { label: "Kept until 2036", rule: "hpcsa_adult", retainUntil: "2036-08-12", legalHold: false },
};

const table = dsarExportTable(SAMPLE, "Sipho Khumalo");
const find = (section: string, field: string) => table.rows.filter((r) => r[0] === section && r[2] === field);

describe("the POPIA export as a table", () => {
  it("is a real export table the shared menu can render", () => {
    expect(table.headers).toEqual(["Section", "Record", "Field", "Value"]);
    expect(table.filenameBase).toBe("data-export-sipho-khumalo-2026-08-10");
    expect(table.title).toBe("Data held on Sipho Khumalo");
    expect(table.subtitle).toContain("Masizakhe Counselling");
    expect(table.rows.every((r) => r.length === 4)).toBe(true);
  });

  it("loses nothing: every field of every record survives", () => {
    // Count the fields the source holds, then the rows the table produced.
    const sections = ["client", "demographics", "appointments", "clinicalNotes", "outcomes", "consents", "documents", "invoices", "accessAudit"] as const;
    let expected = 0;
    for (const key of sections) {
      const v = SAMPLE[key] as unknown;
      if (Array.isArray(v)) expected += v.reduce((n, item) => n + Object.keys(item).length, 0);
      else expected += Object.keys(v as object).length;
    }
    const dataRows = table.rows.filter((r) => r[0] !== "Record retention" && r[0] !== "Export");
    expect(dataRows.length).toBe(expected);
  });

  it("names each record the way a person would", () => {
    const sessions = table.rows.filter((r) => r[0] === "Sessions");
    expect(sessions.every((r) => r[1] === "2026-08-12T08:00:00.000Z" || r[1] === "2026-08-19T08:00:00.000Z")).toBe(true);
    expect(find("Invoices", "Status")[0]?.[1]).toBe("INV-0007");
    expect(find("Outcome measures", "Score")[0]?.[1]).toBe("PHQ-9");
  });

  it("keeps nested structures verbatim instead of dropping them", () => {
    expect(find("Personal details", "Profile")[0]?.[3]).toBe('{"dateOfBirth":"1990-04-02"}');
  });

  it("keeps false and zero, which a truthiness check would swallow", () => {
    expect(find("Personal details", "Risk flag")[0]?.[3]).toBe("true");
    expect(find("Record retention", "Legal hold")[0]?.[3]).toBe("false");
    expect(cellValue(0)).toBe("0");
    expect(cellValue(false)).toBe("false");
    expect(cellValue(null)).toBe("");
  });

  it("skips a section the person simply has none of", () => {
    expect(table.rows.some((r) => r[0] === "Care plan")).toBe(false);
  });

  it("closes with retention and provenance", () => {
    expect(find("Record retention", "Label")[0]?.[3]).toBe("Kept until 2036");
    expect(find("Export", "Generated at")[0]?.[3]).toBe("2026-08-10T09:00:00.000Z");
    expect(find("Export", "Practice")[0]?.[3]).toBe("Masizakhe Counselling");
  });

  it("reads database columns as words", () => {
    expect(humanField("homeLanguage")).toBe("Home language");
    expect(humanField("amountCents")).toBe("Amount cents");
    expect(humanField("retain_until")).toBe("Retain until");
  });

  it("handles a person with nothing on file without producing an empty file", () => {
    const bare = dsarExportTable(
      { generatedAt: "2026-08-10T09:00:00.000Z", organisation: { id: "o", name: "Practice" }, retention: { label: "n/a", rule: "none", retainUntil: null, legalHold: false } },
      "New Person",
    );
    expect(bare.rows.length).toBeGreaterThan(0);
    expect(bare.filenameBase).toBe("data-export-new-person-2026-08-10");
  });
});
