import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { OrgsTable } from "@/components/admin/orgs-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organisations" };

export default async function AdminOrgsPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const rows = await provider.listPlatformOrgs();

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Organisations"
        summary={`${rows.length} organisations on Phila. Configure plans, suspend, or impersonate (audited).`}
      />
      <OrgsTable rows={rows} />
    </div>
  );
}
