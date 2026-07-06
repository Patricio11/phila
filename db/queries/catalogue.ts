import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { services as servicesTable, rooms as roomsTable, sites as sitesTable } from "@/db/schema";

function realId(prefix: string, id: string | undefined): string {
  return id && !id.startsWith(`${prefix}_new_`) ? id : `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Replace the org's service catalogue with `list` (upsert kept, delete removed). RLS-scoped. */
export async function saveServices(orgId: string, list: { id: string; name: string; durationMin: number; priceCents: number | null }[]): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const rows = list.map((s) => ({ id: realId("svc", s.id), orgId, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }));
    const keep = rows.map((r) => r.id);
    await db.delete(servicesTable).where(keep.length ? and(eq(servicesTable.orgId, orgId), notInArray(servicesTable.id, keep)) : eq(servicesTable.orgId, orgId));
    for (const r of rows) {
      await db.insert(servicesTable).values(r).onConflictDoUpdate({ target: servicesTable.id, set: { name: r.name, durationMin: r.durationMin, priceCents: r.priceCents } });
    }
  });
}

/** Upsert a single room (create with a real id, or update an existing one). RLS-scoped. */
export async function saveRoom(orgId: string, room: { id?: string; name: string; siteId: string; capacity: number; equipment: string[]; status: string; colour: string }): Promise<void> {
  await runForOrg(orgId, async () => {
    const id = realId("room", room.id);
    const values = { id, orgId, siteId: room.siteId, name: room.name, capacity: room.capacity, equipment: room.equipment, status: room.status, colour: room.colour };
    await activeDb().insert(roomsTable).values(values).onConflictDoUpdate({ target: roomsTable.id, set: { siteId: values.siteId, name: values.name, capacity: values.capacity, equipment: values.equipment, status: values.status, colour: values.colour } });
  });
}

/** Replace the org's sites with `list` (upsert kept, delete removed). RLS-scoped. */
export async function saveSites(orgId: string, list: { id: string; name: string; province: string }[]): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const rows = list.map((s) => ({ id: realId("site", s.id), orgId, name: s.name, province: s.province }));
    const keep = rows.map((r) => r.id);
    await db.delete(sitesTable).where(keep.length ? and(eq(sitesTable.orgId, orgId), notInArray(sitesTable.id, keep)) : eq(sitesTable.orgId, orgId));
    for (const r of rows) {
      await db.insert(sitesTable).values(r).onConflictDoUpdate({ target: sitesTable.id, set: { name: r.name, province: r.province } });
    }
  });
}
