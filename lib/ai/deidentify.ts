/**
 * De-identification (Phase 14, POPIA)  strip direct identifiers from session
 * cues BEFORE any cross-border model call. Pure + unit-tested. The model writes
 * about "the client"; identity stays in Phila's metadata, never in the prompt.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deidentify(text: string, names: string[] = []): string {
  let out = text;
  // Names (full first, then parts) → [client]. Longest match first.
  const tokens = [...new Set(names.flatMap((n) => [n, ...n.split(/\s+/)]).filter((t) => t && t.length >= 2))].sort((a, b) => b.length - a.length);
  for (const t of tokens) {
    out = out.replace(new RegExp(`\\b${escapeRegex(t)}\\b`, "gi"), "[client]");
  }
  out = out.replace(/\b\d{13}\b/g, "[id-number]"); // SA ID
  out = out.replace(/(?:\+27|0)\s?(?:\d\s?){9}/g, "[phone]"); // SA phone
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");
  return out.replace(/\[client\](?:\s+\[client\])+/g, "[client]"); // collapse runs
}
