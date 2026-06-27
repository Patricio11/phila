import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { ConsentCentre } from "@/components/client/consent-centre";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consent" };

export default async function MeConsentPage() {
  const { principal, clientId } = await requireClient();
  const provider = await getDataProvider();

  const client = await provider.getClient(clientId);
  if (!client) notFound();
  const consents = await provider.getClientConsents(clientId);

  await logAccess({
    action: "consent.change",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: client.orgId,
    target: `client:${clientId}/consent`,
    reason: "view_consent_centre",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Your consent"
        summary="You're in control. Turn any of these on or off  changes take effect right away."
      />
      <div className="flex items-start gap-2.5 rounded-control border border-accent/25 bg-accent-soft/40 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
        <p className="text-[13px] leading-relaxed text-text-2">
          Your information is special personal information under POPIA. It&apos;s kept confidential,
          only the people caring for you can see it, and every access is recorded.
        </p>
      </div>
      <ConsentCentre records={consents} />
    </div>
  );
}
