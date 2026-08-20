/**
 * Batch 4r - the reference a filed form response carries, e.g. `SN-20260806-3F2K1A`:
 * initials of the form's title, the session (or submission) date, and a short
 * stable suffix from the assignment id - so every filed session note is
 * traceable to its exact session at a glance. Pure.
 */
export function formReference(formTitle: string, dateISO: string, seedId: string): string {
  const words = (formTitle ?? "").split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 3);
  const prefix = (words.length >= 2 ? words[0]![0]! + words[1]![0]! : words[0]?.slice(0, 2) ?? "FR").toUpperCase();
  const d = new Date(dateISO);
  const ymd = Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(d).replace(/-/g, "")
    : "00000000";
  const suffix = (seedId ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase().padStart(6, "0");
  return `${prefix}-${ymd}-${suffix}`;
}

/** The filed document's name: "<Form title> SN-... - <Client> - 6 Aug 2026.pdf". */
export function filedResponseName(formTitle: string, reference: string, clientName: string, dateISO: string): string {
  const day = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(new Date(dateISO));
  return `${formTitle} ${reference} - ${clientName} - ${day}.pdf`.replace(/[\\/:*?"<>|]/g, "").slice(0, 160);
}
