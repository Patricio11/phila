import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Phase 18  document flows against the real DB: assign → client-visible, the
 * request → fulfil loop, the counsellor lane (own + shared), and the scan gate.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL = DATABASE_URL;
const sql = neon(DATABASE_URL);

import {
  assignToClientDb,
  fulfilRequestDb,
  getRequestRow,
  insertClientUpload,
  listClientRequestsDb,
  listClientVisibleDocumentsDb,
  listCounsellorDocumentsDb,
  moveItemsDb,
  shareWithCounsellorDb,
} from "@/db/queries/documents";

const ORG = "org_masizakhe";
const COUNS = "couns_nomsa";
const CID = "cl_doc_probe";
const D_ASSIGN = "doc_probe_assign";
const D_UPLOAD = "doc_probe_upload";
const D_SHARE = "doc_probe_share";
const D_PENDING = "doc_probe_pending";
const REQ = "docreq_probe";
const FOLD = "fold_probe";

async function insertDoc(id: string, opts: { clientId?: string | null; visibility?: string; scan?: string }) {
  await sql`INSERT INTO documents (id, org_id, client_id, name, kind, visibility, storage_provider, storage_key, scan_status, size_label, shared_by, bytes, created_at)
    VALUES (${id}, ${ORG}, ${opts.clientId ?? null}, ${"Probe " + id}, 'report', ${opts.visibility ?? "internal"}, 'supabase', ${"k/" + id}, ${opts.scan ?? "clean"}, '1 KB', 'org', 1024, now())
    ON CONFLICT (id) DO NOTHING`;
}

beforeAll(async () => {
  await sql`INSERT INTO clients (id, org_id, name, phone, email, province, primary_counsellor_id, risk_flag, created_at)
    VALUES (${CID}, ${ORG}, 'Doc Probe', '+27820001234', 'docprobe@example.co.za', 'Gauteng', ${COUNS}, false, now())
    ON CONFLICT (id) DO NOTHING`;
}, 30000);

afterAll(async () => {
  for (const id of [D_ASSIGN, D_UPLOAD, D_SHARE, D_PENDING]) await sql`DELETE FROM documents WHERE id=${id}`;
  await sql`DELETE FROM document_requests WHERE id=${REQ}`;
  await sql`DELETE FROM document_folders WHERE id=${FOLD}`;
  await sql`DELETE FROM document_shares WHERE org_id=${ORG} AND shared_with=${COUNS} AND target_id=${D_SHARE}`;
  await sql`DELETE FROM clients WHERE id=${CID}`;
}, 30000);

describe("document flows (Phase 18)", () => {
  it("assign-to-client makes a doc client-visible", async () => {
    await insertDoc(D_ASSIGN, { clientId: null, visibility: "internal", scan: "clean" });
    let visible = await listClientVisibleDocumentsDb(CID);
    expect(visible.some((d) => d.id === D_ASSIGN)).toBe(false); // internal + unassigned → hidden

    await assignToClientDb(ORG, [D_ASSIGN], CID);
    visible = await listClientVisibleDocumentsDb(CID);
    const doc = visible.find((d) => d.id === D_ASSIGN);
    expect(doc).toBeTruthy();
    expect(doc!.visibility).toBe("client_visible");
  });

  it("request → fulfil: the client uploads against an open request", async () => {
    await sql`INSERT INTO document_requests (id, org_id, client_id, requested_by, title, status, created_at)
      VALUES (${REQ}, ${ORG}, ${CID}, 'system', 'Copy of your ID', 'pending', now()) ON CONFLICT (id) DO NOTHING`;
    const openBefore = await listClientRequestsDb(CID);
    expect(openBefore.some((r) => r.id === REQ)).toBe(true);

    await insertClientUpload({ id: D_UPLOAD, orgId: ORG, clientId: CID, requestId: REQ, name: "id.pdf", contentType: "application/pdf", storageKey: "k/" + D_UPLOAD, uploadedBy: "user_probe" });
    // Pending (unscanned) → not yet client-visible.
    let visible = await listClientVisibleDocumentsDb(CID);
    expect(visible.some((d) => d.id === D_UPLOAD)).toBe(false);

    // Finalise clean + fulfil the request.
    await sql`UPDATE documents SET scan_status='clean', bytes=2048, size_label='2 KB' WHERE id=${D_UPLOAD}`;
    await fulfilRequestDb(REQ, D_UPLOAD);

    const req = await getRequestRow(REQ);
    expect(req!.status).toBe("fulfilled");
    expect(req!.fulfilledDocumentId).toBe(D_UPLOAD);
    const openAfter = await listClientRequestsDb(CID);
    expect(openAfter.some((r) => r.id === REQ)).toBe(false); // no longer pending
    visible = await listClientVisibleDocumentsDb(CID);
    expect(visible.some((d) => d.id === D_UPLOAD)).toBe(true);
  });

  it("counsellor lane: own clients' docs + shared-with-me, deduped", async () => {
    // D_ASSIGN is on CID, whose primary counsellor is COUNS → appears in `own`.
    // D_SHARE is an org doc (no client) shared directly with COUNS → appears in `shared`.
    await insertDoc(D_SHARE, { clientId: null, visibility: "internal", scan: "clean" });
    await shareWithCounsellorDb(ORG, "file", D_SHARE, COUNS, "user_hub");

    const { own, shared } = await listCounsellorDocumentsDb(COUNS);
    expect(own.some((d) => d.id === D_ASSIGN)).toBe(true);
    expect(shared.some((d) => d.id === D_SHARE)).toBe(true);
    // A doc that is both own and shared is not double-counted.
    expect(shared.some((d) => own.some((o) => o.id === d.id))).toBe(false);
  });

  it("scan gate: a pending file is never client-visible", async () => {
    await insertDoc(D_PENDING, { clientId: CID, visibility: "client_visible", scan: "pending" });
    const visible = await listClientVisibleDocumentsDb(CID);
    expect(visible.some((d) => d.id === D_PENDING)).toBe(false);
  });

  it("move places a document into a folder (metadata-only)", async () => {
    await sql`INSERT INTO document_folders (id, org_id, name, scope, created_at)
      VALUES (${FOLD}, ${ORG}, 'Probe folder', 'org', now()) ON CONFLICT (id) DO NOTHING`;
    await moveItemsDb(ORG, { documentIds: [D_ASSIGN], folderIds: [] }, FOLD);
    const [row] = await sql`SELECT folder_id FROM documents WHERE id=${D_ASSIGN}`;
    expect(row!.folder_id).toBe(FOLD);
  });
});
