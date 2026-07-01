import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { FormDetail } from "@/components/hub/form-detail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Form" };

export default async function HubFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const form = await provider.getForm(membership.orgId, id);
  if (!form) notFound();
  return <FormDetail form={form} />;
}
