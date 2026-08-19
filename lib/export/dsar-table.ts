import type { ExportTable } from "@/lib/export/table-export";

/**
 * Batch 2q - the POPIA data-subject export as a TABLE, so it goes out through
 * the same Export dropdown (CSV / Excel / PDF) as every other list in Phila
 * instead of a hand-rolled JSON download nobody can open.
 *
 * The point of this export is completeness: it is what the practice hands a
 * person who asks what is held about them. So this flattens rather than
 * summarises - every section, every record, every field, one row each. Values
 * that are themselves structures are kept verbatim as JSON rather than dropped.
 */

/** Sections in the order a reader expects them, with human titles. */
const SECTIONS: { key: string; title: string }[] = [
  { key: "client", title: "Personal details" },
  { key: "demographics", title: "Demographics" },
  { key: "carePlan", title: "Care plan" },
  { key: "appointments", title: "Sessions" },
  { key: "clinicalNotes", title: "Clinical notes (metadata)" },
  { key: "outcomes", title: "Outcome measures" },
  { key: "consents", title: "Consents" },
  { key: "documents", title: "Documents" },
  { key: "invoices", title: "Invoices" },
  // Batch 4o - the conversation with the practice (Phase 34.1 client messaging).
  { key: "messages", title: "Messages with the practice" },
  { key: "accessAudit", title: "Who accessed this record" },
];

/**
 * Field names read as words, not as camelCase database columns: "homeLanguage"
 * becomes "Home language". Sentence case, not Title Case, because this is a
 * document a person reads - but an all-caps token (ID, VAT) keeps its shape.
 */
export function humanField(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w, i) => (w === w.toUpperCase() && w.length > 1 ? w : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()));
  return words.join(" ");
}

/** A cell that a spreadsheet can hold: never "[object Object]", never a silent drop. */
export function cellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** A label for one record in a list, preferring the field a human would use. */
function recordLabel(record: Record<string, unknown>, index: number): string {
  // Most specific label first: an invoice is its number, an outcome its
  // measure, a session its date. A bare timestamp is the last resort.
  for (const key of ["number", "name", "measure", "purpose", "startsAt", "issuedAt", "signedAt", "at", "createdAt", "id"]) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return `#${index + 1}`;
}

/** The shape this needs; `DsarExport` satisfies it without having to say so. */
export interface DsarLike {
  generatedAt: string;
  organisation: { id: string; name: string };
  retention: { label: string; rule: string; retainUntil: string | null; legalHold: boolean };
}

/**
 * Flatten a DSAR export into Section / Record / Field / Value rows. Pure, so it
 * is unit-tested: nothing may be lost between the database and the file.
 */
export function dsarExportTable(data: DsarLike, clientName: string): ExportTable {
  const rows: string[][] = [];
  const sections = data as unknown as Record<string, unknown>;

  for (const { key, title } of SECTIONS) {
    const value = sections[key];
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const label = recordLabel(record, i);
        const entries = Object.entries(record);
        if (entries.length === 0) rows.push([title, label, "", ""]);
        for (const [field, v] of entries) rows.push([title, label, humanField(field), cellValue(v)]);
      });
      continue;
    }

    if (typeof value === "object") {
      for (const [field, v] of Object.entries(value as Record<string, unknown>)) {
        rows.push([title, "", humanField(field), cellValue(v)]);
      }
      continue;
    }

    rows.push([title, "", "", cellValue(value)]);
  }

  // Retention and provenance close the file, so the reader knows how long this
  // is kept and exactly when the copy was made.
  for (const [field, v] of Object.entries(data.retention)) {
    rows.push(["Record retention", "", humanField(field), cellValue(v)]);
  }
  rows.push(["Export", "", "Generated at", data.generatedAt]);
  rows.push(["Export", "", "Practice", data.organisation.name]);

  const day = data.generatedAt.slice(0, 10);
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
  return {
    filenameBase: `data-export-${slug}-${day}`,
    title: `Data held on ${clientName}`,
    subtitle: `${data.organisation.name} · POPIA data-subject export · ${day}`,
    headers: ["Section", "Record", "Field", "Value"],
    rows,
  };
}
