import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activeDb, runForOrg } from "@/lib/db/scoped";
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

/** Update the org's weekly business hours (merged into the scheduling JSONB). RLS-scoped. */
export async function saveBusinessHours(orgId: string, hours: unknown): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const [org] = await db.select({ scheduling: orgs.scheduling }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!org) return;
    const scheduling = { ...(org.scheduling as Record<string, unknown>), businessHours: hours };
    await db.update(orgs).set({ scheduling }).where(eq(orgs.id, orgId));
  });
}

/** Update the org's client-portal onboarding policy (the client_portal JSONB). RLS-scoped. */
export async function saveClientPortal(orgId: string, settings: { inviteOnBooking: boolean; inviteOnCreate: boolean }): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(orgs).set({ clientPortal: settings }).where(eq(orgs.id, orgId)));
}

/** Update the org's scheduling defaults (default session length + inter-session interval), merged into scheduling JSONB. RLS-scoped. */
export async function saveSchedulingDefaults(orgId: string, defaults: { defaultDurationMin: number; bufferMin: number }): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const [org] = await db.select({ scheduling: orgs.scheduling }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!org) return;
    const scheduling = { ...(org.scheduling as Record<string, unknown>), defaultDurationMin: defaults.defaultDurationMin, bufferMin: defaults.bufferMin };
    await db.update(orgs).set({ scheduling }).where(eq(orgs.id, orgId));
  });
}

/** Persist the org's name + practice profile (registration/practice no, contact, address). RLS-scoped. */
export async function saveOrgProfileDb(orgId: string, name: string, profile: Record<string, string>): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(orgs).set({ name, profile }).where(eq(orgs.id, orgId)));
}

export interface InvoiceSettingsRow {
  vatRegistered: boolean; vatNumber: string; pricesIncludeVat: boolean; invoicePrefix: string;
  paymentTermsDays: number; bankName: string; accountName: string; accountNumber: string;
  branchCode: string; showPayButton: boolean;
}
const INVOICE_DEFAULTS: InvoiceSettingsRow = {
  vatRegistered: false, vatNumber: "", pricesIncludeVat: false, invoicePrefix: "INV",
  paymentTermsDays: 14, bankName: "", accountName: "", accountNumber: "", branchCode: "", showPayButton: false,
};

/** The org's invoicing config, merged over sensible defaults. RLS-scoped. */
export async function getInvoiceSettingsDb(orgId: string): Promise<InvoiceSettingsRow> {
  return runForOrg(orgId, async () => {
    const [row] = await activeDb().select({ s: orgs.invoiceSettings }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    return { ...INVOICE_DEFAULTS, ...((row?.s as Partial<InvoiceSettingsRow>) ?? {}) };
  });
}

/** Persist the org's invoicing config. RLS-scoped. */
export async function saveInvoiceSettingsDb(orgId: string, settings: InvoiceSettingsRow): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(orgs).set({ invoiceSettings: { ...settings } }).where(eq(orgs.id, orgId)));
}

/** Enable/disable one org feature flag, merged into the features JSONB (dormant-by-default). RLS-scoped. */
export async function setOrgFeature(orgId: string, feature: string, enabled: boolean): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const [org] = await db.select({ features: orgs.features }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!org) return;
    const features = { ...(org.features as Record<string, boolean>), [feature]: enabled };
    await db.update(orgs).set({ features }).where(eq(orgs.id, orgId));
  });
}
