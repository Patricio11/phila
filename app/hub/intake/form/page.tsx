import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { IntakeFormEditor } from "@/components/hub/intake-form-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake form" };

export default async function HubIntakeFormPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const form = await provider.getIntakeForm(membership.orgId);

  return (
    <div className="rise mx-auto max-w-2xl space-y-6">
      <Link href="/hub/intake" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-3 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back to intake
      </Link>
      <PageHead
        title="Intake form"
        summary="The questions every new client answers before their first session. These are yours to shape — add, reorder, or remove anything to fit how your practice works."
      />
      <IntakeFormEditor initial={form} orgId={membership.orgId} />
    </div>
  );
}
