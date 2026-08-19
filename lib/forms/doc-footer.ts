/**
 * Batch 4q - the footer line on every page of a practice's printed documents:
 * "174-733 NPO | 145 Sir Lowry Road, Woodstock 7925 | info@practice.org.za".
 * The practice may type its own (Settings → Organisation → Branding) and a form
 * may override it (Design tab); otherwise it is composed from the profile. Pure.
 */
export function composeDocumentFooter(p: { registrationNo?: string | null; practiceNo?: string | null; address?: string | null; email?: string | null; phone?: string | null; website?: string | null }, orgName?: string): string {
  const parts: string[] = [];
  const reg = (p.registrationNo ?? "").trim();
  if (reg) parts.push(/npo|npc|pty|cc|trust/i.test(reg) ? reg : `${reg} NPO`);
  const pr = (p.practiceNo ?? "").trim();
  if (pr) parts.push(/practice/i.test(pr) ? pr : `Practice no. ${pr}`);
  const addr = (p.address ?? "").replace(/\s*\n\s*/g, ", ").trim();
  if (addr) parts.push(addr);
  const email = (p.email ?? "").trim();
  if (email) parts.push(email);
  else if ((p.phone ?? "").trim()) parts.push((p.phone ?? "").trim());
  else if ((p.website ?? "").trim()) parts.push((p.website ?? "").trim());
  if (parts.length === 0 && orgName) return orgName;
  return parts.join(" | ");
}

/** What actually prints: the form's own footer, else the practice's, else the composed one. */
export function effectiveDocumentFooter(formFooter: string | null | undefined, orgFooter: string | null | undefined, composed: string): string {
  const f = (formFooter ?? "").trim(); if (f) return f;
  const o = (orgFooter ?? "").trim(); if (o) return o;
  return composed;
}
