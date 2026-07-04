import type { ImportField } from "@/lib/import/schema";
import type { ParsedFile } from "@/lib/import/parse";

export interface BuiltRow {
  name: string;
  phone: string | null;
  email: string | null;
  province: string | null;
}

export interface BuildResult {
  ready: BuiltRow[];
  /** Rows set aside  a required field was missing (never dropped silently). */
  attention: { row: number; value: string; reason: string }[];
  /** Skipped because they already exist (in the org or earlier in the file). */
  duplicates: number;
  total: number;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** SA numbers → a stored form matching /^(\+27|0)\d{9}$/, or null if unreadable. */
export function normalizePhone(raw: string): string | null {
  const s = (raw ?? "").replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(s)) return s;
  if (/^\+27\d{9}$/.test(s)) return s;
  if (/^27\d{9}$/.test(s)) return `+${s}`;
  if (/^\d{9}$/.test(s)) return `0${s}`;
  return null;
}

export function normalizeEmail(raw: string): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  return EMAIL_RE.test(s) ? s : null;
}

/** Match a cell to an enum value (case-insensitive) or a declared alias. */
export function matchEnum(raw: string, field: ImportField): string | null {
  const l = (raw ?? "").trim().toLowerCase();
  if (!l) return null;
  const direct = field.enumValues?.find((v) => v.toLowerCase() === l);
  if (direct) return direct;
  return field.aliases?.[l] ?? null;
}

/** The last 9 digits of a phone  canonical across 0…, +27…, 27… for de-dupe. */
export function phoneKey(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 9 ? `p:${d.slice(-9)}` : null;
}
export function emailKey(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return EMAIL_RE.test(e) ? `e:${e}` : null;
}

/** Transform the mapped grid into clean, de-duped client rows. */
export function buildRows(fields: ImportField[], parsed: ParsedFile, mapping: Record<string, number | null>, existingKeys: Set<string>): BuildResult {
  const col = (key: string, r: string[]): string => {
    const idx = mapping[key];
    return idx == null ? "" : (r[idx] ?? "").trim();
  };
  const field = (key: string) => fields.find((f) => f.key === key);
  const provinceField = field("province");

  const ready: BuiltRow[] = [];
  const attention: BuildResult["attention"] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  parsed.rows.forEach((r, i) => {
    const rowNo = i + 2; // +1 for the header, +1 for 1-indexing
    const name = col("name", r).replace(/\s+/g, " ").trim();
    if (name.length < 2) {
      // Only flag a truly non-empty-but-bad row; blank trailing rows are ignored.
      if (r.some((c) => c.trim() !== "")) attention.push({ row: rowNo, value: name || "(blank)", reason: "Missing name" });
      return;
    }
    const phone = normalizePhone(col("phone", r));
    const email = normalizeEmail(col("email", r));
    const province = provinceField ? matchEnum(col("province", r), provinceField) : null;

    // De-dupe: prefer a contact key; else fall back to name within this file only.
    const contact = phoneKey(phone) ?? emailKey(email);
    const key = contact ?? `n:${name.toLowerCase()}`;
    if (contact ? existingKeys.has(key) || seen.has(key) : seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    ready.push({ name, phone, email, province });
  });

  return { ready, attention, duplicates, total: parsed.rows.length };
}
