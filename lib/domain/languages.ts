/**
 * Phase 32.0 - the language set (plan section 3). Tiers are honest capability:
 * 1 = full rail target, 2 = content only, 3 = recorded so the unmet need is
 * measurable. SASL is recorded, never machine-interpreted.
 */
export interface LanguageDef {
  code: string;
  nameEn: string;
  nameNative: string;
  tier: 1 | 2 | 3;
  railCapable: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  // Tier 1 - full rail target
  { code: "en-ZA", nameEn: "English", nameNative: "English", tier: 1, railCapable: true },
  { code: "xh-ZA", nameEn: "isiXhosa", nameNative: "isiXhosa", tier: 1, railCapable: true },
  { code: "zu-ZA", nameEn: "isiZulu", nameNative: "isiZulu", tier: 1, railCapable: true },
  { code: "af-ZA", nameEn: "Afrikaans", nameNative: "Afrikaans", tier: 1, railCapable: true },
  { code: "st-ZA", nameEn: "Sesotho", nameNative: "Sesotho", tier: 1, railCapable: true },
  // Tier 2 - content only until models mature
  { code: "nso-ZA", nameEn: "Sepedi", nameNative: "Sepedi", tier: 2, railCapable: false },
  { code: "tn-ZA", nameEn: "Setswana", nameNative: "Setswana", tier: 2, railCapable: false },
  { code: "ts-ZA", nameEn: "Xitsonga", nameNative: "Xitsonga", tier: 2, railCapable: false },
  { code: "ss-ZA", nameEn: "siSwati", nameNative: "siSwati", tier: 2, railCapable: false },
  { code: "ve-ZA", nameEn: "Tshivenda", nameNative: "Tshivenda", tier: 2, railCapable: false },
  { code: "nr-ZA", nameEn: "isiNdebele", nameNative: "isiNdebele", tier: 2, railCapable: false },
  // Tier 3 - recorded, not served (the unmet need made measurable)
  { code: "fr", nameEn: "French", nameNative: "Français", tier: 3, railCapable: false },
  { code: "pt", nameEn: "Portuguese", nameNative: "Português", tier: 3, railCapable: false },
  { code: "ln", nameEn: "Lingala", nameNative: "Lingála", tier: 3, railCapable: false },
  { code: "so", nameEn: "Somali", nameNative: "Soomaali", tier: 3, railCapable: false },
  { code: "am", nameEn: "Amharic", nameNative: "አማርኛ", tier: 3, railCapable: false },
  { code: "sn", nameEn: "Shona", nameNative: "chiShona", tier: 3, railCapable: false },
  { code: "ny", nameEn: "chiChewa", nameNative: "Chichewa", tier: 3, railCapable: false },
  { code: "sgn-ZA", nameEn: "SA Sign Language", nameNative: "SASL", tier: 3, railCapable: false },
];

export const LANGUAGE_BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

/** Native name for display; falls back to the code so nothing renders blank. */
export function languageName(code: string | null | undefined): string {
  if (!code) return "";
  return LANGUAGE_BY_CODE.get(code)?.nameNative ?? code;
}

export const GAP_HANDLING_LABELS: Record<string, string> = {
  none: "No gap - matched or English",
  family_interpreted: "A family member interpreted",
  staff_interpreted: "A staff member interpreted",
  struggled_through: "Struggled through without help",
  rebooked: "Rebooked to a matching counsellor",
};
