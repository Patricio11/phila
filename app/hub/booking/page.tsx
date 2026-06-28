import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { BookingSettingsForm } from "@/components/hub/booking-settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking" };

export default async function HubBookingPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();

  const [settings, services, counsellors, org] = await Promise.all([
    provider.getBookingSettings(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  if (!org) notFound();

  return (
    <div className="rise mx-auto max-w-2xl space-y-6">
      <PageHead
        title="Booking"
        summary="How clients book you online. Everything here shapes your public booking page — what's offered, by whom, and on what terms."
      />
      <BookingSettingsForm initial={settings} services={services} counsellors={counsellors} orgSlug={org.slug} />
    </div>
  );
}
