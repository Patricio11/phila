import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, clients, orgs } from "@/db/schema";
import { deliver } from "@/lib/messaging/deliver";
import { getMessagingSettings } from "@/db/queries/messaging";

/**
 * Document notifications (Phase 18), routed through the Phase-12 deliver chokepoint
 * (consent / opt-out / quiet-hours / credits all honoured; dormant channels never
 * fake a send). Never throws — a notification failure must not break the action.
 */
async function loadDoc(documentId: string) {
  const [row] = await getDb()
    .select({
      orgId: documents.orgId, name: documents.name, clientId: documents.clientId,
      clientName: clients.name, clientPhone: clients.phone, clientEmail: clients.email, orgName: orgs.name,
    })
    .from(documents)
    .leftJoin(clients, eq(documents.clientId, clients.id))
    .leftJoin(orgs, eq(documents.orgId, orgs.id))
    .where(eq(documents.id, documentId))
    .limit(1);
  return row ?? null;
}

function firstName(name: string | null | undefined, fallback: string): string {
  return (name ?? fallback).split(" ")[0] ?? fallback;
}

/** Org → client: a document was shared with the client. */
export async function notifyDocumentShared(documentId: string): Promise<void> {
  try {
    const row = await loadDoc(documentId);
    if (!row || !row.clientId) return;
    await deliver({
      orgId: row.orgId,
      trigger: "document_shared",
      ref: `docshare:${documentId}`,
      recipient: { phone: row.clientPhone, email: row.clientEmail, preferredContact: null },
      vars: { clientName: firstName(row.clientName, "there"), practiceName: row.orgName ?? "your practice", documentName: row.name, serviceName: "", counsellorName: "", date: "", time: "" },
    });
  } catch {
    /* notifications never break the action */
  }
}

/** Client → practice: a client uploaded a document (sent to the practice's email). */
export async function notifyClientUpload(documentId: string): Promise<void> {
  try {
    const row = await loadDoc(documentId);
    if (!row) return;
    const settings = await getMessagingSettings(row.orgId);
    const practiceEmail = settings.emailReplyTo;
    if (!practiceEmail) return; // no staff address to notify — the Hub's "Needs review" view still surfaces it
    await deliver({
      orgId: row.orgId,
      trigger: "client_uploaded_document",
      ref: `docupload:${documentId}`,
      recipient: { phone: null, email: practiceEmail, preferredContact: "email" },
      vars: { clientName: firstName(row.clientName, "A client"), practiceName: row.orgName ?? "your practice", documentName: row.name, serviceName: "", counsellorName: "", date: "", time: "" },
    });
  } catch {
    /* notifications never break the action */
  }
}
