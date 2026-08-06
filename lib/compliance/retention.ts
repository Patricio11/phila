/**
 * Phase 31.2 - HPCSA-aware retention clocks (POPIA "no longer than needed,
 * unless another law requires it" × HPCSA minimum record retention).
 *
 * EVERY number lives here so an advisor correction is a one-line change:
 *   - Clinical records: kept ≥ CLINICAL_RETENTION_YEARS from the LAST entry.
 *   - Minors: kept until the client's MINOR_RETAIN_UNTIL_AGE'th birthday
 *     (whichever of the two clocks ends LATER wins).
 *   - Mental incapacity: indefinite (retainUntil = null).
 *
 * ⚠️ Confirm these against the current HPCSA booklet with a POPIA-literate
 * advisor before launch (plan §31.2 / honest constraints).
 *
 * Pure + injectable-now (lib/clock convention): no I/O, fully unit-tested.
 * The clock is COMPUTED on read from facts we already hold (last entry, DOB) -
 * never a stored column an org could mis-set. Orgs never configure retention.
 */

export const CLINICAL_RETENTION_YEARS = 6;
export const MINOR_RETAIN_UNTIL_AGE = 21;

export type RetentionRule = "standard" | "minor" | "incapacity";

export interface RetentionInput {
  /** ISO date of the LAST entry in the record (e.g. most recent session/note). */
  lastEntryAt: string;
  /** Client date of birth (yyyy-mm-dd) if known - drives the minor rule. */
  dateOfBirth?: string | null;
  /** Recorded mental incapacity → indefinite retention. (No capture surface yet; callers pass false.) */
  incapacitated?: boolean;
}

export interface RetentionClock {
  /** When the record may lawfully be destroyed/de-identified. null = indefinite. */
  retainUntil: string | null;
  /** Which rule set the clock (the LATER clock wins for minors). */
  rule: RetentionRule;
}

function addYears(iso: string, years: number): Date {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** The retention clock for a clinical record. Deterministic; pass `now` where needed. */
export function retentionClock(input: RetentionInput): RetentionClock {
  if (input.incapacitated) return { retainUntil: null, rule: "incapacity" };

  const standardEnd = addYears(input.lastEntryAt, CLINICAL_RETENTION_YEARS);

  if (input.dateOfBirth) {
    const wasMinorAtLastEntry =
      new Date(input.lastEntryAt).getTime() < addYears(input.dateOfBirth, 18).getTime();
    if (wasMinorAtLastEntry) {
      const age21 = addYears(input.dateOfBirth, MINOR_RETAIN_UNTIL_AGE);
      // HPCSA: a minor's record is held until age 21 - but never SHORTER than the standard clock.
      const later = age21.getTime() > standardEnd.getTime() ? age21 : standardEnd;
      return { retainUntil: later.toISOString(), rule: "minor" };
    }
  }

  return { retainUntil: standardEnd.toISOString(), rule: "standard" };
}

/** Has the clock expired (destruction lawful)? Indefinite never expires. */
export function retentionExpired(clock: RetentionClock, nowISO: string): boolean {
  if (clock.retainUntil === null) return false;
  return new Date(nowISO).getTime() >= new Date(clock.retainUntil).getTime();
}

/**
 * Can this record be erased on a data-subject request right now?
 * POPIA erasure is honoured where lawful; where HPCSA retention still applies the
 * record is de-identified-where-possible + restricted, with an honest reason.
 */
export function erasureDecision(
  clock: RetentionClock,
  nowISO: string,
  legalHold: boolean,
): { allowed: boolean; reason: string } {
  if (legalHold) {
    return { allowed: false, reason: "This record is under a legal hold and cannot be destroyed until the hold is lifted." };
  }
  if (retentionExpired(clock, nowISO)) {
    return { allowed: true, reason: "Retention period has lapsed - destruction is lawful." };
  }
  if (clock.retainUntil === null) {
    return { allowed: false, reason: "HPCSA requires indefinite retention of this clinical record (recorded incapacity). Personal identifiers are removed where possible; the clinical record is retained and restricted." };
  }
  const until = new Date(clock.retainUntil).toISOString().slice(0, 10);
  return { allowed: false, reason: `HPCSA requires this clinical record to be retained until ${until}. Personal identifiers are removed where possible; the clinical record is retained and restricted until then.` };
}

/** A calm, human status line for the Data & privacy panel. */
export function retentionLabel(clock: RetentionClock, nowISO: string): string {
  if (clock.retainUntil === null) return "Retained indefinitely (HPCSA - recorded incapacity)";
  const until = new Date(clock.retainUntil).toISOString().slice(0, 10);
  if (retentionExpired(clock, nowISO)) return `Retention lapsed on ${until} - destruction is lawful`;
  const why = clock.rule === "minor" ? `minor - kept until age ${MINOR_RETAIN_UNTIL_AGE}` : `${CLINICAL_RETENTION_YEARS} years from last entry`;
  return `Retained until ${until} (${why})`;
}
