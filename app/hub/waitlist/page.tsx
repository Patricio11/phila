import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { now as clockNow } from "@/lib/clock";
import { PageHead } from "@/components/shell/page-head";
import { WaitlistBoard, type WaitlistRow } from "@/components/hub/waitlist-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waitlist" };

/**
 * Batch 2t - the waitlist finally has a home. It was a card on the calendar
 * that only appeared when a feature switch was on; now that employer intakes
 * feed it, the people waiting need somewhere they can be seen, read and booked.
 */
export default async function HubWaitlistPage() {
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = clockNow();
  const isDb = process.env.DATA_PROVIDER === "db";

  const [org, clients, services, counsellors, rooms] = await Promise.all([
    provider.getOrg(membership.orgId),
    provider.listClients(membership.orgId),
    provider.listServices(membership.orgId),
    provider.listCounsellors(membership.orgId),
    provider.listRooms(membership.orgId),
  ]);

  const rows: WaitlistRow[] = isDb
    ? await (await import("@/db/queries/waitlist")).listWaitlistDetailedDb(membership.orgId)
    : [];
  // The page still opens when the feature is off - people already waiting must
  // not become invisible - but it says plainly that nobody new is being added.
  const waitlistOn = isDb
    ? (await (await import("@/db/queries/features")).effectiveFeaturesDb(membership.orgId)).waitlist
    : Boolean(org?.features.waitlist);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `org:${membership.orgId}/waitlist`,
    reason: "hub_oversight",
  });

  const scheduling = {
    orgId: membership.orgId,
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    counsellors: counsellors.map((c) => ({ id: c.id, name: c.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
    defaultDurationMin: org?.scheduling.defaultDurationMin ?? 50,
    businessHours: org?.scheduling.businessHours ?? { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  };

  // Batch 4q - the practice's document identity for the answers document + export.
  const brand = process.env.DATA_PROVIDER === "db" ? await (await import("@/db/queries/doc-brand")).getDocBrandDb(membership.orgId) : null;

  return (
    <div className="rise space-y-6">
      <Link href="/hub/clients" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 transition-colors hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All clients
      </Link>

      <PageHead
        title="Waitlist"
        summary="People waiting for a first session - whoever completed an intake form, plus anyone the practice added by hand. Book them when a slot opens."
      />

      {!waitlistOn && (
        <p className="rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-[12.5px] leading-relaxed text-warn">
          The client waitlist is switched off in Settings, so nobody new is being added - not from an intake form, and not from a client record.
          {rows.length > 0 ? " The people below were added before it was switched off." : ""}
        </p>
      )}

      <WaitlistBoard rows={rows} scheduling={scheduling} nowISO={now} brand={brand} />
    </div>
  );
}
