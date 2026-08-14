/**
 * Batch 3l - the appointment reference. Every appointment id is
 * `appt_` + 12 random hex chars, so a short, human-friendly booking
 * reference can be DERIVED from the id - deterministic, needs no column,
 * and works for every appointment that has ever existed. It reads like
 * a git short-sha: "APT-3F9A2C".
 *
 * Pure and isomorphic (no crypto, no server-only) so the calendar modal,
 * the invoice preview, notifications and search all derive the same code.
 */

/** The booking reference for an appointment id, e.g. "APT-3F9A2C". */
export function appointmentReference(appointmentId: string): string {
  return `APT-${appointmentId.slice(-6).toUpperCase()}`;
}

/**
 * Parse what a person typed into the id suffix it refers to, or null when
 * it doesn't look like a reference. Forgiving on purpose: "APT-3F9A2C",
 * "apt 3f9a2c" and a bare "3F9A2C" all resolve. Requires at least 4 hex
 * chars so ordinary search words never false-match.
 */
export function parseAppointmentReference(query: string): string | null {
  const m = query.trim().toUpperCase().match(/^(?:APT[-\s]?)?([0-9A-F]{4,12})$/);
  return m ? m[1]!.toLowerCase() : null;
}

/** Does this appointment id answer to that typed reference? */
export function matchesReference(appointmentId: string, query: string): boolean {
  const suffix = parseAppointmentReference(query);
  return suffix !== null && appointmentId.toLowerCase().endsWith(suffix);
}
