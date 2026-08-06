import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDataProvider } from "@/lib/data-provider";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { recordPageEvent, getOrgLogoUrlPublic } from "@/db/queries/public-page";

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

  // Master switch: the practice takes bookings by invite only.
  if (!config.enabled || config.services.length === 0 || config.counsellors.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-[20px] font-semibold text-text">Booking isn&apos;t open online</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-text-2">
          {config.org.name} arranges sessions directly. Please contact the practice and they&apos;ll set up your first appointment.
        </p>
      </main>
    );
  }

  void recordPageEvent(config.org.id, "book_click"); // PII-free funnel (Phase 17)
  const initialServiceId = config.services.some((s) => s.id === service) ? service! : null;
  const logoUrl = process.env.DATA_PROVIDER === "db" ? await getOrgLogoUrlPublic(config.org.id) : null;

  // Phase 32.0 behind the feature switch: off = the wizard is exactly pre-32.0.
  let languageEnabled = false;
  if (process.env.DATA_PROVIDER === "db") {
    const { effectiveFeaturesDb } = await import("@/db/queries/features");
    languageEnabled = (await effectiveFeaturesDb(config.org.id)).language;
  } else {
    const org = await provider.getOrg(config.org.id);
    languageEnabled = Boolean(org?.features.language);
  }

  return <BookingWizard config={config} initialServiceId={initialServiceId} logoUrl={logoUrl} languageEnabled={languageEnabled} />;
}
