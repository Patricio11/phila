import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { formAssignments, appointments, clients, documents } from "@/db/schema";
import { ensureClientFolderDb } from "@/db/queries/documents";
import { getDocBrandDb } from "@/db/queries/doc-brand";
import { buildResponsePdfBytes } from "@/lib/export/response-pdf-server";
import { formReference, filedResponseName } from "@/lib/forms/reference";
import { getStorageProvider, activeStorageBackend, objectKey } from "@/lib/storage";
import { sizeLabel } from "@/lib/documents/quota";
import { logAccess } from "@/lib/audit";
import type { FormField } from "@/lib/domain/types";

/**
 * Batch 4r - file a COUNSELLOR-filled form response (the session note) as the
 * practice's letterhead PDF in the client's folder, the moment it is submitted.
 *
 * The document carries a per-session reference (SN-YYYYMMDD-XXXXXX), lands in
 * the client's folder - which lives under the assigned counsellor's folder -
 * is marked clinical, and is idempotent: one document per assignment
 * (`doc_fr_<assignmentId>`); a resubmission overwrites the same file.
 *
 * Best-effort by contract: filing must never break the submission. When Phila
 * Storage is off the filing is skipped and audited honestly.
 */
export async function fileCounsellorFormResponse(assignmentId: string): Promise<{ filed: boolean; reason: string }> {
  try {
    const db = getDb();
    const [a] = await db.select().from(formAssignments)
      .where(eq(formAssignments.id, assignmentId)).limit(1);
    if (!a || !a.counsellorId || !a.clientId || a.status !== "completed" || !a.answers) return { filed: false, reason: "not_a_counsellor_fill" };

    const [client] = await db.select({ id: clients.id, name: clients.name }).from(clients)
      .where(and(eq(clients.id, a.clientId), eq(clients.orgId, a.orgId), isNull(clients.deletedAt))).limit(1);
    if (!client) return { filed: false, reason: "no_client" };

    const storage = await getStorageProvider();
    if (storage.status !== "live") {
      await logAccess({ action: "admin.action", actor: { userId: "system:file", platformRole: null, teamRole: null }, orgId: a.orgId, target: `form_assignment:${assignmentId}`, reason: "response_file_skipped_storage_off" });
      return { filed: false, reason: "storage_off" };
    }

    // The session's date (the reference's date) - the appointment when known, else the submission.
    let sessionISO = (a.submittedAt ?? a.sentAt).toISOString();
    if (a.appointmentId) {
      const [appt] = await db.select({ startsAt: appointments.startsAt }).from(appointments)
        .where(and(eq(appointments.id, a.appointmentId), eq(appointments.orgId, a.orgId))).limit(1);
      if (appt) sessionISO = appt.startsAt.toISOString();
    }

    const snapshot = a.snapshot as { title?: string; fields?: FormField[] };
    const formTitle = snapshot?.title ?? "Form";
    const fields = (snapshot?.fields ?? []) as FormField[];
    const answers = (a.answers as Record<string, string>) ?? {};
    const reference = formReference(formTitle, sessionISO, assignmentId);
    const name = filedResponseName(formTitle, reference, client.name, sessionISO);

    const brand = await getDocBrandDb(a.orgId);
    const bytes = await buildResponsePdfBytes({ formTitle, fields, answers, brand, reference });

    const documentId = `doc_fr_${assignmentId}`;
    const key = objectKey(a.orgId, documentId, name);
    const upload = await storage.signedUploadUrl({ key, contentType: "application/pdf" });
    const put = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: Buffer.from(bytes), signal: AbortSignal.timeout(30_000) });
    if (!put.ok) return { filed: false, reason: `storage_put_${put.status}` };

    // The client's folder - homed under their counsellor (and healed there if they moved).
    const { folderId } = await ensureClientFolderDb(a.orgId, client);
    const backend = await activeStorageBackend();
    const now = new Date();
    await runForOrg(a.orgId, async () => {
      const dbo = activeDb();
      const [existing] = await dbo.select({ id: documents.id }).from(documents).where(eq(documents.id, documentId)).limit(1);
      if (existing) {
        await dbo.update(documents).set({ folderId, name, bytes: bytes.length, sizeLabel: sizeLabel(bytes.length), storageKey: key, storageProvider: backend, scanStatus: "clean", createdAt: now, deletedAt: null })
          .where(eq(documents.id, documentId));
      } else {
        await dbo.insert(documents).values({
          id: documentId, orgId: a.orgId, folderId, clientId: a.clientId, counsellorId: a.counsellorId,
          sessionId: a.appointmentId ?? null, name, kind: "report", visibility: "clinical",
          storageProvider: backend, storageKey: key, contentType: "application/pdf",
          bytes: bytes.length, sizeLabel: sizeLabel(bytes.length), scanStatus: "clean",
          uploadedBy: null, sharedBy: "counsellor", createdAt: now,
        });
      }
    });

    await logAccess({ action: "admin.action", actor: { userId: "system:file", platformRole: null, teamRole: null }, orgId: a.orgId, target: `document:${documentId}`, reason: `response_filed_${reference}` });
    return { filed: true, reason: reference };
  } catch (e) {
    return { filed: false, reason: e instanceof Error ? e.message.slice(0, 80) : "error" };
  }
}
