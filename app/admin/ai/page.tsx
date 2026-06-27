import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { AiRail } from "@/components/admin/ai-rail";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI rail" };

export default async function AdminAiPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const config = await provider.getAiRail();

  return (
    <div className="rise space-y-6">
      <PageHead
        title="AI rail"
        summary="One platform-held key powers the scribe for every org. Dormant by default; live only once POPIA s.72 is acknowledged."
      />
      <AiRail initial={config} />
    </div>
  );
}
