import { describe, it, expect } from "vitest";
import { computeHubOverview } from "@/lib/domain/dashboards";
import type { Appointment, Client, Counsellor, Invoice, Service } from "@/lib/domain/types";

const NOW = "2026-06-29T09:00:00+02:00"; // a Monday

const counsellors = [
  { id: "c1", credential: { status: "verified" } },
  { id: "c2", credential: { status: "pending" } },
] as unknown as Counsellor[];

const clients = [
  { id: "cl1", name: "Risky", riskFlag: true, createdAt: "2026-06-29T08:00:00+02:00", deletedAt: null },
  { id: "cl2", name: "Calm", riskFlag: false, createdAt: "2026-01-01T08:00:00+02:00", deletedAt: null },
] as unknown as Client[];

const appointments = [
  { clientId: "cl1", state: "completed", startsAt: "2026-06-29T08:00:00+02:00", serviceId: "s1" },
  { clientId: "cl2", state: "no_show", startsAt: "2026-06-29T10:00:00+02:00", serviceId: "s1" },
  { clientId: "cl1", state: "scheduled", startsAt: "2026-06-30T08:00:00+02:00", serviceId: "s1" },
] as unknown as Appointment[];

const invoices = [
  { status: "paid", amountCents: 45000, issuedAt: "2026-06-29T08:00:00+02:00" },
] as unknown as Invoice[];

const services = [{ id: "s1", priceCents: 50000 }] as unknown as Service[];

describe("computeHubOverview", () => {
  const r = computeHubOverview({ counsellors, clients, appointments, invoices, services, measuredClientIds: new Set(["cl1"]), now: NOW });

  it("counts distinct clients seen today / this week", () => {
    expect(r.clientsToday).toBe(2);
    expect(r.clientsWeek).toBe(2);
  });

  it("computes the no-show rate from held + missed sessions", () => {
    expect(r.noShowRate).toBe(50); // 1 no-show of (1 completed + 1 no-show)
  });

  it("counts new clients today and pending credentials", () => {
    expect(r.newClientsToday).toBe(1);
    expect(r.pendingCredentials).toBe(1);
  });

  it("open intakes = clients with no completed/discharged session", () => {
    expect(r.openIntakes).toBe(1); // cl2 (only a no-show) is still open
  });

  it("income: actual paid + predicted from future scheduled", () => {
    expect(r.income.todayCents).toBe(45000);
    expect(r.incomeMonthCents).toBe(45000);
    expect(r.incomePredictionCents).toBe(95000); // 45000 paid + 50000 scheduled (svc s1)
  });

  it("outcome coverage + attention items (risk + credentials)", () => {
    expect(r.outcomesCoverage).toEqual({ captured: 1, total: 2 });
    expect(r.attention.map((a) => a.id)).toEqual(["risk_cl1", "creds"]);
  });
});
