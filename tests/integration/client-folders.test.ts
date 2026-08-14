import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (env.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (env.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL!);

/**
 * Batch 3g - client folders. The filing decision lives in insertClientUpload:
 * a client's upload lands in THEIR folder under Documents -> Clients, created
 * on the spot if missing. (The e2e can't reach this here: the storage presign
 * needs a reachable host and fails before the insert.)
 */
describe("client folders", () => {
  it("ensure is idempotent and a client upload files into their folder", { timeout: 40_000 }, async () => {
    const { ensureClientFolderDb, insertClientUpload, folderDocumentsDb } = await import("@/db/queries/documents");
    const stamp = Date.now();
    const clientId = `cl_cf_${stamp}`;
    await sql`INSERT INTO clients (id, org_id, name, province, created_at) VALUES (${clientId}, 'org_masizakhe', ${`Folder Probe ${stamp}`}, 'Gauteng', now())`;
    try {
      const first = await ensureClientFolderDb("org_masizakhe", { id: clientId, name: `Folder Probe ${stamp}` });
      expect(first.created).toBe(true);
      const again = await ensureClientFolderDb("org_masizakhe", { id: clientId, name: `Folder Probe ${stamp}` });
      expect(again.created).toBe(false);
      expect(again.folderId).toBe(first.folderId);

      // The upload row files itself into that folder - no caller passes it.
      const docId = `doc_cf_${stamp}`;
      await insertClientUpload({
        id: docId, orgId: "org_masizakhe", clientId, requestId: `docreq_cf_${stamp}`,
        name: "id.pdf", contentType: "application/pdf", storageKey: `org_masizakhe/${docId}/id.pdf`, uploadedBy: null,
      });
      const docs = await folderDocumentsDb("org_masizakhe", first.folderId);
      expect(docs.some((d) => d.id === docId)).toBe(true);
    } finally {
      await sql`DELETE FROM documents WHERE client_id=${clientId}`;
      await sql`DELETE FROM document_folders WHERE client_id=${clientId}`;
      await sql`DELETE FROM clients WHERE id=${clientId}`;
    }
  });
});
