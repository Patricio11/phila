import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import {
  clients, appointments, carePlans, clientDocuments, outcomeMeasures, invoices,
  documents, documentFolders, documentRequests, formAssignments,
} from "@/db/schema";

/**
 * Client merge (W1.6). Duplicate detection is real (`findDuplicateClients`); this
 * makes the *action* real. It re-points every child record  sessions (+ their
 * notes, which follow the appointment), care plans, outcomes, invoices, documents,
 * document requests, form assignments  onto the kept id, then soft-deletes the
 * losers. History is never lost or double-counted (Outcome-Honesty Rule).
 *
 * Runs as one RLS-scoped transaction (`runForOrg` → phila_app): atomic, and Postgres
 * refuses any cross-org write. Three tables carry a uniqueness constraint on the
 * client (consents `(client_id, purpose)`, grant_allocations `(grant_id, client_id)`,
 * demographics `client_id` PK)  for those we fill only the gaps the keeper is
 * missing, so the keeper's own record always wins and no constraint is violated.
 */
export async function mergeClientsDb(
  orgId: string,
  keepId: string,
  mergeIds: string[],
): Promise<{ ok: boolean; merged: number }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();

    // The kept record must be a live client in this org.
    const [keeper] = await db
      .select({ id: clients.id, phone: clients.phone, email: clients.email, profile: clients.profile })
      .from(clients)
      .where(and(eq(clients.id, keepId), eq(clients.orgId, orgId), isNull(clients.deletedAt)))
      .limit(1);
    if (!keeper) return { ok: false, merged: 0 };

    // Losers: live clients in this org, excluding the keeper.
    const loserRows = await db
      .select({ id: clients.id, phone: clients.phone, email: clients.email })
      .from(clients)
      .where(and(inArray(clients.id, mergeIds), eq(clients.orgId, orgId), isNull(clients.deletedAt)));
    const losers = loserRows.map((r) => r.id).filter((id) => id !== keepId);
    if (losers.length === 0) return { ok: false, merged: 0 };

    // 1) Re-point the 1:many history onto the kept id (org-scoped where the table has org_id).
    await db.update(appointments).set({ clientId: keepId }).where(and(inArray(appointments.clientId, losers), eq(appointments.orgId, orgId)));
    await db.update(carePlans).set({ clientId: keepId }).where(inArray(carePlans.clientId, losers));
    await db.update(outcomeMeasures).set({ clientId: keepId }).where(inArray(outcomeMeasures.clientId, losers));
    await db.update(clientDocuments).set({ clientId: keepId }).where(and(inArray(clientDocuments.clientId, losers), eq(clientDocuments.orgId, orgId)));
    await db.update(invoices).set({ clientId: keepId }).where(and(inArray(invoices.clientId, losers), eq(invoices.orgId, orgId)));
    await db.update(documents).set({ clientId: keepId }).where(and(inArray(documents.clientId, losers), eq(documents.orgId, orgId)));
    await db.update(documentFolders).set({ clientId: keepId }).where(and(inArray(documentFolders.clientId, losers), eq(documentFolders.orgId, orgId)));
    await db.update(documentRequests).set({ clientId: keepId }).where(and(inArray(documentRequests.clientId, losers), eq(documentRequests.orgId, orgId)));
    await db.update(formAssignments).set({ clientId: keepId }).where(and(inArray(formAssignments.clientId, losers), eq(formAssignments.orgId, orgId)));
    // session_notes follow their appointment (no client_id)  already re-pointed above.

    // 2) Uniqueness-constrained tables: fill only the purposes/grants the keeper lacks,
    //    picking one loser row per key (most recent wins) so no unique index is violated.
    //    (Expand the loser ids into a value list  the driver won't bind a JS array to ANY().)
    const loserList = sql.join(losers.map((id) => sql`${id}`), sql`, `);
    await db.execute(sql`
      UPDATE consents SET client_id = ${keepId}
      WHERE org_id = ${orgId} AND id IN (
        SELECT DISTINCT ON (purpose) id FROM consents
        WHERE client_id IN (${loserList}) AND org_id = ${orgId}
          AND purpose NOT IN (SELECT purpose FROM consents WHERE client_id = ${keepId})
        ORDER BY purpose, updated_at DESC
      )`);
    await db.execute(sql`
      UPDATE grant_allocations SET client_id = ${keepId}
      WHERE id IN (
        SELECT DISTINCT ON (grant_id) id FROM grant_allocations
        WHERE client_id IN (${loserList})
          AND grant_id NOT IN (SELECT grant_id FROM grant_allocations WHERE client_id = ${keepId})
        ORDER BY grant_id, id
      )`);
    await db.execute(sql`
      UPDATE demographics SET client_id = ${keepId}
      WHERE client_id IN (${loserList})
        AND NOT EXISTS (SELECT 1 FROM demographics WHERE client_id = ${keepId})
        AND client_id = (SELECT client_id FROM demographics WHERE client_id IN (${loserList}) ORDER BY client_id LIMIT 1)`);

    // 3) Backfill the keeper's missing contact from a loser (a merge should consolidate, not lose, a number/email).
    const patch: { phone?: string; email?: string } = {};
    if (!keeper.phone) { const donor = loserRows.find((r) => r.phone)?.phone; if (donor) patch.phone = donor; }
    if (!keeper.email) { const donor = loserRows.find((r) => r.email)?.email; if (donor) patch.email = donor; }
    if (Object.keys(patch).length > 0) {
      await db.update(clients).set(patch).where(eq(clients.id, keepId));
    }

    // 4) Soft-delete the losers  record + full history retained, restorable.
    await db.update(clients).set({ deletedAt: new Date() }).where(and(inArray(clients.id, losers), eq(clients.orgId, orgId)));

    return { ok: true, merged: losers.length };
  });
}
