import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { ServicesManager } from "@/components/hub/services-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services" };

export default async function HubServicesPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const services = await provider.listServices(membership.orgId);

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Services"
        summary="What you offer  name, length, and price. These are the services clients book, the calendar schedules, and you invoice for."
      />
      <ServicesManager initial={services} />
    </div>
  );
}
