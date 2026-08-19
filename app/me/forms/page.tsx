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
  // Batch 4q - the practice's document identity for the client's own PDF.
  let brand = null;
  if (process.env.DATA_PROVIDER === "db") {
    const { getDb } = await import("@/db/client");
    const { clients } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [c] = await getDb().select({ orgId: clients.orgId }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (c) brand = await (await import("@/db/queries/doc-brand")).getDocBrandDb(c.orgId);
  }

  return (
    <div className="rise space-y-6">
      <PageHead title="Forms" summary="Forms your practice has asked you to fill in. Tap one to complete it  it only takes a few minutes." />
      <ClientForms forms={forms} brand={brand} />
    </div>
  );
}
