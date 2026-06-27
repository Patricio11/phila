/**
 * Soft-delete + right-to-erasure convention (POPIA data-subject rights). Records
 * carry `deletedAt`; nothing is hard-deleted on the request path, so compiled
 * statistics never distort when a client is removed (Outcome-Honesty Rule). A
 * scheduled pruner performs lawful hard-erasure after the retention window  that
 * cron is wired in Phase 18; the convention and stubs exist now.
 */
export interface SoftDeletable {
  deletedAt: string | null;
}

export function isDeleted(record: SoftDeletable): boolean {
  return record.deletedAt !== null;
}

/** Filter live records out of a collection (default everywhere PII is listed). */
export function liveOnly<T extends SoftDeletable>(records: readonly T[]): T[] {
  return records.filter((r) => r.deletedAt === null);
}

export function softDelete<T extends SoftDeletable>(record: T, now: string): T {
  return { ...record, deletedAt: now };
}

/**
 * Erasure job stub  Phase 18 makes this a cron that hard-deletes records past
 * their retention window while preserving the de-identified aggregates funders
 * and the org already relied on. Defined now so the seam exists.
 */
export interface ErasureJob {
  /** Hard-erase soft-deleted records older than `retentionDays`. */
  run(opts: { orgId: string; retentionDays: number; now: string }): Promise<{ erased: number }>;
}

export const erasureJobStub: ErasureJob = {
  async run() {
    // Intentionally inert in Part A  see Phase 18.
    return { erased: 0 };
  },
};
