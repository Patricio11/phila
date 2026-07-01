import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { FormBuilder } from "@/components/hub/form-builder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit form" };

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const form = await provider.getForm(membership.orgId, id);
  if (!form) notFound();
  return (
    <div className="rise space-y-5">
      <Link href={`/hub/forms/${form.id}`} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-text-3 hover:text-text">
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> Back to form
      </Link>
      <PageHead title="Edit form" summary="Changes apply to new sends. Answers already collected keep the version they were sent." />
      <FormBuilder initial={form} orgId={membership.orgId} orgName={membership.orgName} />
    </div>
  );
}
