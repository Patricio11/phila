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

  return <FormDetail form={result.form} responses={result.rows} clients={clients} />;
}
