import { PROVINCES } from "@/lib/domain/enums";

/**
 * Entity-agnostic bulk-import schema. A consumer declares the fields it wants; the
 * parser + auto-mapper + validator (parse.ts / automap.ts / validate.ts) and the
 * <ColumnMapper> UI all work off this. Add a new import by declaring a field list.
 */
export type ImportKind = "text" | "phone" | "email" | "enum";

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  kind: ImportKind;
  /** Header pattern for auto-mapping (matched case-insensitively). */
  match: RegExp;
  /** Allowed values for kind "enum". */
  enumValues?: readonly string[];
  /** Lower-cased alias → canonical value, for enum matching (e.g. "gp" → "Gauteng"). */
  aliases?: Record<string, string>;
  hint?: string;
}

/** Province short-codes people actually type in spreadsheets. */
const PROVINCE_ALIASES: Record<string, string> = {
  gp: "Gauteng", gauteng: "Gauteng",
  wc: "Western Cape", "w cape": "Western Cape", "western cape": "Western Cape",
  kzn: "KwaZulu-Natal", "kwazulu natal": "KwaZulu-Natal", "kwazulu-natal": "KwaZulu-Natal", natal: "KwaZulu-Natal",
  ec: "Eastern Cape", "e cape": "Eastern Cape", "eastern cape": "Eastern Cape",
  fs: "Free State", "free state": "Free State",
  lp: "Limpopo", limpopo: "Limpopo",
  mp: "Mpumalanga", mpumalanga: "Mpumalanga",
  nc: "Northern Cape", "n cape": "Northern Cape", "northern cape": "Northern Cape",
  nw: "North West", "north west": "North West", "north-west": "North West",
};

/** Clients: name is the only required field. No counsellor — bulk-imported clients
 *  land unassigned (the org assigns from the caseload afterwards). */
export const CLIENT_IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "Full name", required: true, kind: "text", match: /^(full[\s_-]*)?name$|client\s*name|^client$|surname|first[\s_-]*name/i, hint: "Required" },
  { key: "phone", label: "Phone", required: false, kind: "phone", match: /phone|mobile|cell|contact|tel|number|msisdn|whatsapp/i },
  { key: "email", label: "Email", required: false, kind: "email", match: /e.?mail/i },
  { key: "province", label: "Province", required: false, kind: "enum", enumValues: PROVINCES, aliases: PROVINCE_ALIASES, match: /province|region|location|area|state/i },
];
