import "server-only";
import { eq } from "drizzle-orm";
import { activeDb } from "@/lib/db/scoped";
import { clients, counsellors } from "@/db/schema";
import type { ClientProfileView } from "@/lib/data-provider";
import type { Province } from "@/lib/domain/enums";

/**
 * Client self-service profile (W1.3). The editable extras (date of birth, address,
 * emergency contact, preferred channel) live in `clients.profile` JSONB; name/phone/
 * email are columns. Call inside a `runForClient` / `runForOrg` (uses `activeDb`).
 */
const PREF = ["WhatsApp", "Phone call", "Email"];

export async function getClientProfileDb(clientId: string): Promise<ClientProfileView | null> {
  const db = activeDb();
  const [c] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!c) return null;
  const couns = c.primaryCounsellorId
    ? (await db.select({ name: counsellors.name }).from(counsellors).where(eq(counsellors.id, c.primaryCounsellorId)).limit(1))[0]
    : undefined;
  const p = (c.profile as Record<string, string>) ?? {};
  return {
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    province: c.province as Province,
    dateOfBirth: p.dateOfBirth ?? "",
    address: p.address ?? "",
    emergencyName: p.emergencyName ?? "",
    emergencyPhone: p.emergencyPhone ?? "",
    preferredContact: PREF.includes(p.preferredContact ?? "") ? p.preferredContact! : "WhatsApp",
    counsellorName: couns?.name ?? "your counsellor",
    memberSince: c.createdAt.toISOString(),
  };
}

export async function saveClientProfileDb(
  clientId: string,
  cols: { name: string; phone: string; email: string },
  profile: Record<string, string>,
): Promise<void> {
  await activeDb().update(clients)
    .set({ name: cols.name.trim(), phone: cols.phone.trim() || null, email: cols.email.trim() || null, profile })
    .where(eq(clients.id, clientId));
}
