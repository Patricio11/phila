import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { NotificationsSettings } from "@/components/hub/notifications-settings";
import { TemplateManager } from "@/components/hub/template-manager";
import { getMessagingSettings, getWhatsappConnection, getCreditBalances, getTemplates } from "@/db/queries/messaging";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsSettingsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const org = await provider.getOrg(membership.orgId);
  if (!org) notFound();

  const [settings, whatsapp, credits, templates] = await Promise.all([
    getMessagingSettings(membership.orgId),
    getWhatsappConnection(membership.orgId),
    getCreditBalances(membership.orgId),
    getTemplates(membership.orgId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <PageHead title="Notifications" summary="Reach clients on WhatsApp, SMS, and email — on their preferred channel, with your wording." />

      <Card>
        <CardHead title="Channels" />
        <div className="px-[17px] pb-[17px]">
          <p className="mb-3 text-[12.5px] text-text-2">WhatsApp uses your own Business number. SMS and email run on Phila credits.</p>
          <NotificationsSettings
            settings={settings}
            whatsapp={whatsapp}
            credits={credits}
            practiceName={org.name}
          />
        </div>
      </Card>

      <Card>
        <CardHead title="Message templates" />
        <div className="px-[17px] pb-[17px]">
          <p className="mb-3 text-[12.5px] text-text-2">Edit the wording clients receive. Reset any message back to the Phila default at any time.</p>
          <TemplateManager templates={templates} practiceName={org.name} />
        </div>
      </Card>
    </div>
  );
}
