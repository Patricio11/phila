import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { PageHead } from "@/components/shell/page-head";
import { FormBuilder } from "@/components/hub/form-builder";

export const dynamic = "force-dynamic";
export const metadata = { title: "New form" };

export default async function NewFormPage() {
  const { membership } = await requireHub();
  return (
    <div className="rise space-y-5">
      <Link href="/hub/forms" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-text-3 hover:text-text">
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> All forms
      </Link>
      <PageHead title="New form" summary="Pick a template to start, or build from scratch. You can preview it exactly as a client will see it." />
      <FormBuilder initial={null} orgId={membership.orgId} orgName={membership.orgName} />
    </div>
  );
}
