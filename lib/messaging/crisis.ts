/**
 * Batch 4m - crisis support in client conversations. OFF until Phila's super
 * admin switches the function on for practices (Admin → Feature control →
 * Platform functions); every practice then has it and may switch it off for
 * itself under Settings → Messaging → Notifications.
 *
 * The rule never blocks and never punishes: the message is saved and delivered
 * exactly as written. When it reads as self-harm, two quiet things happen:
 * the staff in that conversation (and the org's admins) get a bell - never the
 * text - and the AUTHOR alone sees SADAG / Lifeline under their message, once.
 * Pure + unit-tested; no network, no AI, no model - a short, conservative
 * phrase list in the plain English South Africans actually type.
 */

export interface CrisisLine { name: string; phone: string; note: string; href: string }

/** South African 24-hour lines. SADAG runs the national Suicide Crisis Line. */
export const CRISIS_LINES: CrisisLine[] = [
  { name: "SADAG", phone: "0800 567 567", note: "free · 24 hours", href: "tel:0800567567" },
  { name: "SADAG SMS", phone: "31393", note: "text, they call back", href: "sms:31393" },
  { name: "Lifeline", phone: "0861 322 322", note: "24 hours", href: "tel:0861322322" },
];

/* Conservative phrases. Word boundaries + optional apostrophes/spaces so
 * "dont want to be here", "don't wanna live", "self-harm" and "selfharm" match,
 * but "dying to see you" / "killing it at work" / "dead tired" do not. */
const PATTERNS: RegExp[] = [
  /\b(kill|end|take)(ing)?\s+my\s*self\b/i,
  /\bkill(ing)?\s+myself\b/i,
  /\bend(ing)?\s+(it\s+all|my\s+life|everything)\b/i,
  /\btak(e|ing)\s+my\s+(own\s+)?life\b/i,
  /\b(want|wanna|wish)(ed)?\s+to\s+(die|be\s+dead|disappear\s+forever|not\s+(wake\s+up|exist))\b/i,
  /\bwish(ed)?\s+i\s+(was|were)\s+dead\b/i,
  /\b(don'?t|dont|do\s+not)\s+want\s+to\s+(be\s+(alive|here\s+anymore)|live|wake\s+up|go\s+on)\b/i,
  /\b(don'?t|dont)\s+wanna\s+(live|be\s+here|wake\s+up)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+(reason|point)\s+(to\s+live|in\s+living|living)\b/i,
  /\bnot\s+worth\s+living\b/i,
  /\bsuicid(e|al)\b/i,
  /\bself[\s-]?harm/i,
  /\b(hurt|cut|harm)(ting|ing)?\s+myself\b/i,
  /\bover\s?dos(e|ing)\b/i,
  /\bjump\s+off\b/i,
  /\b(wil|want to|going to|gonna)\s+(hang|shoot|cut)\s+myself\b/i,
];

/** Does this text read as self-harm? Conservative on purpose. */
export function readsAsCrisis(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 4) return false;
  return PATTERNS.some((re) => re.test(t));
}
