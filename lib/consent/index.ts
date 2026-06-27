/**
 * Consent  versioned, purpose-bound, with a strict state machine
 * (`none → granted(v) → revoked`, re-grantable to a new version). This is the
 * Consent-Before-Capture Rule made into code: no purpose-bound data is read or
 * captured unless an *active* grant exists. The UI lands in Phase 2/3; the table
 * persists in Phase 9  the rules live here from commit one.
 */
import type { ConsentPurpose, ConsentState } from "@/lib/domain/enums";

export interface Consent {
  purpose: ConsentPurpose;
  state: ConsentState;
  /** The version of the consent text the subject agreed to. */
  version: number;
  updatedAt: string;
}

export class ConsentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentError";
  }
}

/** Only an active grant authorises purpose-bound processing. */
export function isConsentActive(consent: Consent | undefined): boolean {
  return consent?.state === "granted";
}

/**
 * Grant (or re-grant) a purpose at a given consent-text version. A revoked
 * consent can be granted again  at the *current* version, never silently
 * reusing the old one.
 */
export function grant(
  current: Consent | undefined,
  purpose: ConsentPurpose,
  version: number,
  now: string,
): Consent {
  if (version < 1) throw new ConsentError("Consent version must be >= 1");
  if (current && current.purpose !== purpose)
    throw new ConsentError("Consent purpose mismatch");
  return { purpose, state: "granted", version, updatedAt: now };
}

/** Revoke an existing grant. Revoking when there was nothing granted is a no-op-safe error. */
export function revoke(current: Consent | undefined, purpose: ConsentPurpose, now: string): Consent {
  if (!current || current.state !== "granted")
    throw new ConsentError("Cannot revoke a purpose that is not granted");
  return { ...current, purpose, state: "revoked", updatedAt: now };
}

/**
 * Assert an active consent or throw  call at the boundary of any purpose-bound
 * read (demographics, AI processing, funder reporting, comms, …).
 */
export function assertConsent(consent: Consent | undefined, purpose: ConsentPurpose): void {
  if (!isConsentActive(consent))
    throw new ConsentError(`Missing active consent for purpose: ${purpose}`);
}
