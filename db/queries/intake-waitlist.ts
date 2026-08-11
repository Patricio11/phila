import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { getDb } from "@/db/client";
import { clients, forms, formAssignments, waitlistEntries } from "@/db/schema";
import type { FormSnapshot } from "@/lib/domain/types";

/**
 * Batch 2t - what happens when someone who is NOT yet a client completes a form
 * that feeds the waitlist (an employer's intake, or any form with the toggle on).
 *
 * The person becomes a real client immediately. That is the whole point: a
 * floating response cannot be booked, cannot carry a fee arrangement, and cannot
 * be reported to the employer who is paying. Once they are a client linked to
 * the company, every existing path works unchanged - the dossier, the R0 invoice,
 * the company's aggregate usage, the waitlist's own Book button.
 */

/** Pull a likely name / email / phone out of free-form answers. */
export function contactFromAnswers(snapshot: FormSnapshot, answers: Record<string, string>): { name: string | null; email: string | null; phone: string | null } {
  const pick = (test: (label: string, id: string) => boolean): string | null => {
    for (const f of snapshot.fields) {
      const label = (f.label ?? "").toLowerCase();
      if (!test(label, (f.id ?? "").toLowerCase())) continue;
      const v = (answers[f.id] ?? "").trim();
      if (v) return v;
    }
    return null;
  };
  // Field TYPE first (an email field is an email), then the label as a fallback.
  const byType = (type: string): string | null => {
    for (const f of snapshot.fields) {
      if (f.type !== type) continue;
      const v = (answers[f.id] ?? "").trim();
      if (v) return v;
    }
    return null;
  };
  const name = pick((l, id) => /full name|your name|^name$/.test(l) || /name/.test(id) || /name/.test(l));
  const email = byType("email") ?? pick((l) => /e-?mail/.test(l));
  const phone = byType("phone") ?? pick((l) => /phone|mobile|cell|contact number/.test(l));
  return { name, email, phone };
}

export interface IntakeLanding {
  clientId: string;
  clientName: string;
  created: boolean;
  waitlisted: boolean;
}

/**
 * Land a completed response on a real client and, if asked, the waitlist.
 * Matching is by EMAIL only within the org: colleagues share a switchboard
 * number, so matching on phone would merge two different people.
 */
export async function landIntakeResponseDb(input: {
  orgId: string;
  assignmentId: string;
  companyId: string | null;
  province: string;
  contact: { name: string | null; email: string | null; phone: string | null };
  note: string | null;
  addToWaitlist: boolean;
  now: string;
}): Promise<IntakeLanding | null> {
  const name = (input.contact.name ?? "").trim();
  if (name.length < 2) return null; // nothing to make a record from

  return runForOrg(input.orgId, async () => {
    const db = activeDb();
    const email = (input.contact.email ?? "").trim().toLowerCase();

    let clientId: string | null = null;
    if (email) {
      const [match] = await db.select({ id: clients.id }).from(clients)
        .where(and(eq(clients.orgId, input.orgId), isNull(clients.deletedAt), sql`lower(${clients.email}) = ${email}`))
        .limit(1);
      clientId = match?.id ?? null;
    }
    const created = !clientId;

    if (!clientId) {
      clientId = `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await db.insert(clients).values({
        id: clientId, orgId: input.orgId, name,
        phone: input.contact.phone?.trim() || null,
        email: email || null,
        province: input.province,
        primaryCounsellorId: null, // the practice assigns when it books
        riskFlag: false,
        companyId: input.companyId,
        // The employer's retainer pays, so the person is never invoiced.
        feePolicy: input.companyId ? { kind: "retainer" } : null,
        createdAt: new Date(input.now),
      });
    } else if (input.companyId) {
      // An existing client who came through an employer link is now covered by it.
      await db.update(clients)
        .set({ companyId: input.companyId, feePolicy: { kind: "retainer" } })
        .where(and(eq(clients.id, clientId), eq(clients.orgId, input.orgId)));
    }

    // The response belongs on their record, not floating in a share-link list.
    await db.update(formAssignments)
      .set({ clientId, companyId: input.companyId })
      .where(and(eq(formAssignments.id, input.assignmentId), eq(formAssignments.orgId, input.orgId)));

    let waitlisted = false;
    if (input.addToWaitlist) {
      const [already] = await db.select({ id: waitlistEntries.id }).from(waitlistEntries)
        .where(and(eq(waitlistEntries.orgId, input.orgId), eq(waitlistEntries.clientId, clientId), eq(waitlistEntries.status, "waiting")))
        .limit(1);
      if (!already) {
        await db.insert(waitlistEntries).values({
          id: `wl_${crypto.randomUUID()}`, orgId: input.orgId, clientId,
          counsellorId: null, serviceId: null, note: input.note,
          status: "waiting", createdAt: new Date(input.now),
        });
      }
      waitlisted = true;
    }

    return { clientId, clientName: name, created, waitlisted };
  });
}

/** Does this form put everyone who completes it on the waitlist? */
export async function formWaitlistSettingDb(formId: string): Promise<{ orgId: string; title: string; on: boolean } | null> {
  const [f] = await getDb().select({ orgId: forms.orgId, title: forms.title, on: forms.waitlistOnSubmit })
    .from(forms).where(eq(forms.id, formId)).limit(1);
  return f ?? null;
}

export async function setFormWaitlistDb(orgId: string, formId: string, on: boolean): Promise<void> {
  await runForOrg(orgId, () => activeDb().update(forms).set({ waitlistOnSubmit: on })
    .where(and(eq(forms.id, formId), eq(forms.orgId, orgId))));
}
