import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { invoices, carePlans, orgs } from "@/db/schema";

export async function markInvoicePaid(invoiceId: string): Promise<void> {
  await getDb().update(invoices).set({ status: "paid" }).where(eq(invoices.id, invoiceId));
}

/** Toggle a care-plan task's done state (the client's between-session step). */
export async function toggleStep(clientId: string, taskId: string, done: boolean): Promise<void> {
  const db = getDb();
  const [plan] = await db.select().from(carePlans).where(eq(carePlans.clientId, clientId)).limit(1);
  if (!plan) return;
  const tasks = plan.tasks.map((t) => (t.id === taskId ? { ...t, done } : t));
  await db.update(carePlans).set({ tasks }).where(eq(carePlans.id, plan.id));
}

/** Update the org's weekly business hours (merged into the scheduling JSONB). */
export async function saveBusinessHours(orgId: string, hours: unknown): Promise<void> {
  const db = getDb();
  const [org] = await db.select({ scheduling: orgs.scheduling }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org) return;
  const scheduling = { ...(org.scheduling as Record<string, unknown>), businessHours: hours };
  await db.update(orgs).set({ scheduling }).where(eq(orgs.id, orgId));
}
