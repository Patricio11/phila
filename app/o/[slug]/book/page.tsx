import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDataProvider } from "@/lib/data-provider";
import { BookingWizard } from "@/components/booking/booking-wizard";

type Params = { slug: string };
type Search = { service?: string };

export const metadata: Metadata = { title: "Book a session", robots: { index: false } };

/**
 * Booking & intake flow (Phase 2): service + counsellor → time → intake →
 * consent → confirm. Server fetches the booking config; the wizard is a client
 * island. The `?service=` deep-link (from the org page) preselects a service.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const { service } = await searchParams;

  const provider = await getDataProvider();
  const config = await provider.getBookingConfig(slug);
  if (!config) notFound();

  const initialServiceId = config.services.some((s) => s.id === service) ? service! : null;

  return <BookingWizard config={config} initialServiceId={initialServiceId} />;
}
