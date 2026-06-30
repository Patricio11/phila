import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { AiRail } from "@/components/admin/ai-rail";
import { AiProviders } from "@/components/admin/ai-providers";
import { getAiProviders } from "@/db/queries/ai";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI rail" };

export default async function AdminAiPage() {
  await requireSuperAdmin();
  const provider = await getDataProvider();
  const [config, providers] = await Promise.all([provider.getAiRail(), getAiProviders()]);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="AI rail"
        summary="Configure OpenAI or Claude and switch one on. Dormant by default; live only once an org also acknowledges POPIA s.72 cross-border consent."
      />
      <Card>
        <CardHead title="Providers" />
        <div className="px-[17px] pb-[17px]">
          <AiProviders initial={providers} />
        </div>
      </Card>
      <AiRail initial={config} />
    </div>
  );
}
