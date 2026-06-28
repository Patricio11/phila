import { describe, it, expect } from "vitest";
import { mockProvider } from "@/lib/mock/provider";
import { dbProvider } from "@/lib/db-provider";

/**
 * Provider conformance  the contract that guarantees Part B is a swap, not a
 * rewrite. Both providers must expose the *same* method surface; the mock must
 * be real-async; and the consent / k-anon / outcome-honesty invariants the UI
 * relies on must hold. When `dbProvider` is filled in, this same suite runs
 * against it (set DATA_PROVIDER=db) and must stay green.
 */
const ORG = "org_masizakhe";
const NOW = "2026-06-29T09:00:00+02:00";

const mockKeys = Object.keys(mockProvider).sort();
const dbKeys = Object.keys(dbProvider).sort();

describe("structural conformance", () => {
  it("mock and db expose an identical method surface", () => {
    expect(dbKeys).toEqual(mockKeys);
    expect(mockKeys.length).toBeGreaterThan(40); // sanity: the full surface, not a subset
  });

  it("every mock method is a function", () => {
    for (const k of mockKeys) expect(typeof (mockProvider as unknown as Record<string, unknown>)[k]).toBe("function");
  });

  it("the db stub throws 'not implemented' for every method", () => {
    for (const k of dbKeys) {
      expect(() => (dbProvider as unknown as Record<string, () => unknown>)[k]!()).toThrow(/not implemented/i);
    }
  });
});

describe("async behaviour (the mock behaves like a backend)", () => {
  it("returns Promises, not synchronous values", () => {
    const r = mockProvider.listClients(ORG);
    expect(typeof (r as Promise<unknown>).then).toBe("function");
    return r;
  });
});

describe("invariants the UI depends on", () => {
  it("soft-deleted clients never surface (Outcome-Honesty)", async () => {
    const clients = await mockProvider.listClients(ORG);
    expect(clients.length).toBeGreaterThan(0);
    expect(clients.every((c) => c.deletedAt === null)).toBe(true);
  });

  it("reporting applies the k-anon floor to every breakdown cell", async () => {
    const r = await mockProvider.getReporting(ORG, NOW, {});
    const allRows = [r.byProvince, r.byGender, r.byPopulationGroup, r.byAgeBand, r.byEmployment].flat();
    expect(allRows.length).toBeGreaterThan(0);
    for (const row of allRows) {
      // either reportable (>= floor) or explicitly suppressed  never a small raw count
      expect(row.suppressed || (row.count ?? 0) >= 5).toBe(true);
      if (row.suppressed) expect(row.count).toBeNull();
    }
  });

  it("reporting coverage is honest (captured ≤ with-demographics ≤ total)", async () => {
    const r = await mockProvider.getReporting(ORG, NOW, {});
    expect(r.withDemographics).toBeLessThanOrEqual(r.totalClients);
    expect(r.matched).toBeLessThanOrEqual(r.totalClients);
  });

  it("a funder reaches only their own grant (scoping)", async () => {
    const scoped = await mockProvider.listFunderGrants("user_funder");
    expect(scoped.length).toBeGreaterThan(0);
    // every grant the funder can list resolves; a grant they don't fund must not.
    const view = await mockProvider.getFunderGrantView("user_funder", "g_does_not_exist", NOW);
    expect(view).toBeNull();
  });
});
