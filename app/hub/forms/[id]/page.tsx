import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { FormDetail } from "@/components/hub/form-detail";
import type { SendClient } from "@/components/hub/send-form-modal";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Form" };

export default async function HubFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireHub();
  const provider = await getDataProvider();

  const result = await provider.getFormResponses(membership.orgId, id, clockNow());
  if (!result) notFound();

  const [clientList, counsellors] = await Promise.all([
    provider.listClients(membership.orgId),
    provider.listCounsellors(membership.orgId),
  ]);
  const counsellorName = (cid: string | null | undefined) => counsellors.find((c) => c.id === cid)?.name ?? "Unassigned";
  const clients: SendClient[] = clientList
    .map((c) => ({ id: c.id, name: c.name, counsellorName: counsellorName(c.primaryCounsellorId) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Batch 2l - automations + which counsellors may send this form.
  const isDb = process.env.DATA_PROVIDER === "db";
  const { listAutomationsDb } = await import("@/db/queries/form-automations");
  // Batch 4q - the practice's document identity for viewing / exporting answers.
  const brand = isDb ? await (await import("@/db/queries/doc-brand")).getDocBrandDb(membership.orgId) : null;
  const automations = isDb ? (await listAutomationsDb(membership.orgId)).filter((a) => a.formId === id) : [];
  let sharedWithAll = false;
  let sharedWith: string[] = [];
  if (isDb) {
    const { getDb } = await import("@/db/client");
    const { forms } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await getDb().select({ all: forms.sharedWithAll, list: forms.sharedWith }).from(forms).where(eq(forms.id, id)).limit(1);
    sharedWithAll = Boolean(row?.all);
    sharedWith = row?.list ?? [];
  }

  return (
    <FormDetail
      brand={brand}
      form={result.form}
      responses={result.rows}
      clients={clients}
      automations={automations.map((a) => ({ id: a.id, formId: a.formId, trigger: a.trigger, threshold: a.threshold, firstBookingOnly: a.firstBookingOnly, active: a.active, recipient: a.recipient, everySession: a.everySession }))}
      counsellors={counsellors.map((c) => ({ id: c.id, name: c.name }))}
      sharedWithAll={sharedWithAll}
      sharedWith={sharedWith}
    />
  );
}
