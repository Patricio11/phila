import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { ClientForms } from "@/components/client/client-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forms" };

export default async function MeFormsPage() {
  const { clientId } = await requireClient();
  const provider = await getDataProvider();
  const forms = await provider.listClientForms(clientId);

  return (
    <div className="rise space-y-6">
      <PageHead title="Forms" summary="Forms your practice has asked you to fill in. Tap one to complete it  it only takes a few minutes." />
      <ClientForms forms={forms} />
    </div>
  );
}
