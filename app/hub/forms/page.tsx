import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { FormLibrary } from "@/components/hub/form-library";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forms" };

export default async function HubFormsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const forms = await provider.listForms(membership.orgId, clockNow());

  const active = forms.filter((f) => f.status === "active").length;
  const awaiting = forms.reduce((n, f) => n + (f.sentCount - f.completedCount), 0);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Forms"
        summary={`${active} active form${active === 1 ? "" : "s"}${awaiting > 0 ? ` · ${awaiting} awaiting a reply` : ""} · build once, send to anyone, and read what comes back.`}
      />
      <FormLibrary forms={forms} />
    </div>
  );
}
