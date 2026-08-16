import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDataProvider } from "@/lib/data-provider";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { recordPageEvent, getOrgLogoUrlPublic } from "@/db/queries/public-page";

type Params = { slug: string };
type Search = { service?: string; c?: string };

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
  const { service, c } = await searchParams;

  const provider = await getDataProvider();
  const config = await provider.getBookingConfig(slug);
  if (!config) notFound();

  // Batch 2t - this employer has chosen that the PRACTICE books. Their link is
  // the intake form, so an employee holding the old booking URL is sent there
  // rather than quietly booking themselves around the arrangement.
  if (c && process.env.DATA_PROVIDER === "db") {
    const { companyByTokenDb } = await import("@/db/queries/companies");
    const company = await companyByTokenDb(c);
    if (company && company.orgId === config.org.id && company.bookingMode === "practice_books") {
      const { formShareTokenDb } = await import("@/db/queries/forms");
      const share = company.intakeFormId ? await formShareTokenDb(config.org.id, company.intakeFormId) : null;
      if (share) redirect(`/f/${share}?c=${encodeURIComponent(c)}`);
      return (
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="text-[20px] font-semibold text-text">{config.org.name} will arrange your session</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-text-2">
            Your employer has asked the practice to book on your behalf, and the intake form isn&apos;t ready yet.
            Please contact {config.org.name} and they&apos;ll take it from here.
          </p>
        </main>
      );
    }
  }

  // Master switch: the practice takes bookings by invite only.
  if (!config.enabled || config.services.length === 0 || config.counsellors.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-[20px] font-semibold text-text">Booking isn&apos;t open online</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-text-2">
          {config.org.name}{" "}arranges sessions directly. Please contact the practice and they&apos;ll set up your first appointment.
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

  // EAP (batch 2j): ?c=<token> is a company's employee booking link. Resolve it
  // server-side; the wizard shows the covered banner and passes the token back.
  let company: { token: string; name: string } | null = null;
  if (c && process.env.DATA_PROVIDER === "db") {
    const { companyByTokenDb } = await import("@/db/queries/companies");
    const comp = await companyByTokenDb(c);
    if (comp && comp.orgId === config.org.id) company = { token: c, name: comp.name };
  }

  return <BookingWizard config={config} initialServiceId={initialServiceId} logoUrl={logoUrl} languageEnabled={languageEnabled} company={company} />;
}
