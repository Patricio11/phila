/**
 * Phase 33.4 - phone normalisation for dialling. Numbers are stored the way
 * people type them ("082 123 4567"); the carrier needs E.164. South Africa
 * first (the platform's home), with any already-international number passed
 * through. Returns null when the number can't be dialled - the caller shows
 * an honest reason, never places a broken call.
 */
export function toE164(raw: string | null | undefined, defaultCountry = "+27"): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned;
  // 00-prefixed international dialling.
  if (/^00[1-9]\d{7,14}$/.test(cleaned)) return `+${cleaned.slice(2)}`;
  // National format: 0 + 9 digits (SA landline/mobile).
  if (/^0\d{9}$/.test(cleaned)) return `${defaultCountry}${cleaned.slice(1)}`;
  return null;
}
