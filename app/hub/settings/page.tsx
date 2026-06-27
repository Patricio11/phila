import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import type { BusinessHours } from "@/lib/mock/types";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { IntegrationToggles } from "@/components/hub/integration-toggles";
import { PaymentConnectionCard } from "@/components/hub/payment-connection-card";
import { PublicPageEditor } from "@/components/hub/public-page-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const DAYS: { n: 1 | 2 | 3 | 4 | 5 | 6 | 7; label: string }[] = [
  { n: 1, label: "Monday" },
  { n: 2, label: "Tuesday" },
  { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" },
  { n: 5, label: "Friday" },
  { n: 6, label: "Saturday" },
  { n: 7, label: "Sunday" },
];

export default async function HubSettingsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const [settings, page] = await Promise.all([
    provider.getOrgSettings(membership.orgId),
    provider.getOrgPublicPage((await provider.getOrg(membership.orgId))?.slug ?? ""),
  ]);
  if (!settings) notFound();
  const { org } = settings;
  const bh: BusinessHours = org.scheduling.businessHours;

  return (
    <div className="rise space-y-6">
      <PageHead title="Settings" summary="Scheduling, integrations, payments, and your public page." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scheduling */}
        <Card>
          <CardHead title="Scheduling" />
          <div className="space-y-4 px-[17px] pb-[17px]">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Default duration" value={`${org.scheduling.defaultDurationMin} min`} />
              <Stat label="Buffer between sessions" value={`${org.scheduling.bufferMin} min`} />
            </div>
            <div>
              <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-text-3">Business hours</h3>
              <ul className="space-y-1">
                {DAYS.map(({ n, label }) => {
                  const h = bh[n];
                  return (
                    <li key={n} className="flex items-center justify-between text-[13px]">
                      <span className="text-text-2">{label}</span>
                      {h ? (
                        <span className="tabular-nums text-text">
                          {h.start}–{h.end}
                          {h.breaks?.length ? <span className="text-text-3"> · break {h.breaks[0]!.start}–{h.breaks[0]!.end}</span> : null}
                        </span>
                      ) : (
                        <span className="text-text-3">Closed</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Card>

        {/* Public page */}
        <Card>
          <CardHead title="Public page" />
          <div className="px-[17px] pb-[17px]">
            <PublicPageEditor slug={org.slug} initialAccent={org.brandAccent} initialIntro={page?.intro ?? ""} />
          </div>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHead title="Integrations" />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-3 text-[12.5px] text-text-2">Everything starts off. Turn on only what you need — nothing sends or leaves until you do.</p>
            <IntegrationToggles initial={org.features} />
          </div>
        </Card>

        {/* Payments */}
        <Card>
          <CardHead title="Payments — your own gateway" />
          <div className="px-[17px] pb-[17px]">
            <p className="mb-3 text-[12.5px] text-text-2">Connect your gateway so clients pay your org directly. Funds settle to you; Phila just orchestrates.</p>
            <PaymentConnectionCard />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-surface-2 p-3">
      <div className="text-[15px] font-[640] text-text">{value}</div>
      <div className="text-[11.5px] text-text-3">{label}</div>
    </div>
  );
}
