import { notFound } from "next/navigation";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { NotificationsSettings } from "@/components/hub/notifications-settings";
import { TemplateManager } from "@/components/hub/template-manager";
import { getMessagingSettings, getWhatsappConnection, getCreditBalances, getTemplates, listRecentMessages } from "@/db/queries/messaging";

const STATUS_TONE: Record<string, string> = {
  sent: "text-text-2", delivered: "text-accent", failed: "text-danger",
  dormant: "text-text-3", no_credit: "text-warn", opted_out: "text-text-3", quiet_hours: "text-text-3", blocked: "text-text-3", no_channel: "text-text-3",
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsSettingsPage() {
  const { membership } = await requireHub();
  const provider = await getDataProvider();
  const org = await provider.getOrg(membership.orgId);
  if (!org) notFound();

  const [settings, whatsapp, credits, templates, recent] = await Promise.all([
    getMessagingSettings(membership.orgId),
    getWhatsappConnection(membership.orgId),
    getCreditBalances(membership.orgId),
    getTemplates(membership.orgId),
    listRecentMessages(membership.orgId, 12),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <PageHead title="Notifications" summary="Reach clients on WhatsApp, SMS, and email  on their preferred channel, with your wording." />

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

      <Card>
        <CardHead title="Recent activity" />
        <div className="px-[17px] pb-[17px]">
          {recent.length === 0 ? (
            <p className="text-[12.5px] text-text-3">No messages yet. They&apos;ll appear here as bookings, reschedules and reminders go out  with an honest delivery state.</p>
          ) : (
            <ul className="divide-y divide-border text-[12.5px]">
              {recent.map((m, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <span className="w-16 shrink-0 capitalize text-text-2">{m.channel}</span>
                  <span className="w-24 shrink-0 capitalize text-text-3">{m.trigger.replace("_", "-")}</span>
                  <span className="min-w-0 flex-1 truncate text-text">{m.toMasked}</span>
                  <span className={`shrink-0 font-medium capitalize ${STATUS_TONE[m.status] ?? "text-text-3"}`}>{m.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
