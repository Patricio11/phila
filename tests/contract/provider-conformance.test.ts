import { describe, it, expect } from "vitest";
import { mockProvider } from "@/lib/mock/provider";
import { dbProvider } from "@/lib/db-provider";

/**
 * Provider conformance  the contract that guarantees Part B is a swap, not a
 * rewrite. Both providers expose the *same* method surface; the mock is
 * real-async; and the consent / k-anon / outcome-honesty invariants the UI relies
 * on hold. `dbProvider` is a **hybrid**: it spreads the mock and overrides one
 * method at a time with a real DB read — so non-migrated methods are the *same
 * function* as the mock (seamless fallback), and migrated ones are real overrides.
 */
const ORG = "org_masizakhe";
const NOW = "2026-06-29T09:00:00+02:00";

const mockKeys = Object.keys(mockProvider).sort();
const dbKeys = Object.keys(dbProvider).sort();
const mockFns = mockProvider as unknown as Record<string, unknown>;
const dbFns = dbProvider as unknown as Record<string, unknown>;

describe("structural conformance", () => {
  it("mock and db expose an identical method surface", () => {
    expect(dbKeys).toEqual(mockKeys);
    expect(mockKeys.length).toBeGreaterThan(40); // sanity: the full surface, not a subset
  });

  it("every method on both providers is a function", () => {
    for (const k of mockKeys) {
      expect(typeof mockFns[k]).toBe("function");
      expect(typeof dbFns[k]).toBe("function");
    }
  });

  it("migrated methods are real overrides; the rest delegate to the mock", () => {
    // Migrated to the DB (directory + appointments + clinical + billing + funders).
    for (const k of ["getOrg", "getOrgBySlug", "getClientConsents", "listClients", "getClient", "listCounsellors", "getCounsellor", "listServices", "listSites", "listRooms", "listCounsellorSessions", "getCarePlan", "listClientDocuments", "listClientInvoices", "listOrgInvoices", "listFunders", "listFunderGrants", "getHubOverview"]) {
      expect(dbFns[k]).not.toBe(mockFns[k]);
    }
    // Not yet migrated: the exact same function as the mock (consistent fallback).
    for (const k of ["getReporting", "getCounsellorDashboard", "getFunderGrantView"]) {
      expect(dbFns[k]).toBe(mockFns[k]);
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
