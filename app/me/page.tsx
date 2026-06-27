import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Heart, Phone, ShieldCheck } from "lucide-react";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { isConsentActive } from "@/lib/consent";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UpcomingSessionCard } from "@/components/client/upcoming-session-card";
import { CarePlanCard } from "@/components/client/care-plan-card";
import { SessionTimeline } from "@/components/client/session-timeline";

export const dynamic = "force-dynamic";

export default async function MeHomePage() {
  const { principal, clientId } = await requireClient();
  const provider = await getDataProvider();

  const client = await provider.getClient(clientId);
  if (!client) notFound();
  const org = await provider.getOrg(client.orgId);

  const now = new Date().toISOString();
  const nowMs = new Date(now).getTime();
  const [appts, carePlan, consents, invoices] = await Promise.all([
    provider.listAppointmentsForClient(clientId, now),
    provider.getCarePlan(clientId),
    provider.getClientConsents(clientId),
    provider.listClientInvoices(clientId),
  ]);

  await logAccess({
    action: "pii.read",
    actor: { userId: principal.userId, platformRole: "client", teamRole: null },
    orgId: client.orgId,
    target: `client:${clientId}/portal`,
    reason: "own_record",
  });

  const upcoming = appts.find(
    (a) => new Date(a.startsAt).getTime() > nowMs && a.state === "scheduled",
  );
  const counsellorName = upcoming?.counsellorName ?? appts[0]?.counsellorName ?? "your counsellor";
  const carePlanShared = consents.find((c) => c.purpose === "care_plan_share");
  const openInvoices = invoices.filter((i) => i.status === "unpaid");
  const activeConsents = consents.filter((c) => isConsentActive(c)).length;

  const firstName = principal.name.split(" ")[0];

  return (
    <div className="rise-stagger space-y-6">
      <PageHead
        title={`${greeting()}, ${firstName}`}
        summary={
          upcoming
            ? "Here's your next session and what your counsellor shared with you."
            : "Here's your space  your sessions, care plan, and records."
        }
      />

      {upcoming ? (
        <UpcomingSessionCard appt={upcoming} nowISO={now} />
      ) : (
        <Card className="p-2">
          <EmptyState
            icon={CalendarPlus}
            title="No upcoming session"
            body="When you're ready, you can book your next session."
            action={
              org ? (
                <Button asChild>
                  <Link href={`/o/${org.slug}/book`}>Book a session</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {carePlan && isConsentActive(carePlanShared) ? (
            <CarePlanCard plan={carePlan} counsellorName={counsellorName} />
          ) : (
            <Card>
              <CardHead title="From your counsellor" />
              <div className="px-[17px] pb-[17px]">
                <EmptyState
                  icon={ShieldCheck}
                  title="Nothing shared yet"
                  body="After a session, anything your counsellor chooses to share  advice, tasks, resources  will appear here."
                />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHead
              title="Recent sessions"
              action={
                <Link href="/me/sessions" className="text-[12.5px] font-medium text-accent hover:underline">
                  See all
                </Link>
              }
            />
            <div className="px-[17px] pb-[17px]">
              <SessionTimeline appointments={appts.filter((a) => a.state !== "scheduled")} nowISO={now} limit={3} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-[600] text-text">
              <ShieldCheck className="size-4 text-accent" strokeWidth={2} aria-hidden /> Your consent
            </div>
            <p className="mt-1.5 text-[12.5px] text-text-2">
              {activeConsents} {activeConsents === 1 ? "permission is" : "permissions are"} on. You can
              change any of them whenever you like.
            </p>
            <Link
              href="/me/consent"
              className="mt-3 inline-block text-[12.5px] font-medium text-accent hover:underline"
            >
              Manage consent
            </Link>
          </Card>

          {openInvoices.length > 0 && (
            <Card className="p-4">
              <div className="text-[13.5px] font-[600] text-text">
                {openInvoices.length} invoice{openInvoices.length === 1 ? "" : "s"} due
              </div>
              <Link
                href="/me/billing"
                className="mt-1.5 inline-block text-[12.5px] font-medium text-accent hover:underline"
              >
                View billing
              </Link>
            </Card>
          )}

          {/* Always reachable  calm, never alarming (Safeguarding Rule). */}
          <Card className="border-accent/20 bg-accent-soft/40 p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-[640] text-text">
              <Heart className="size-4 text-accent" strokeWidth={2} aria-hidden /> If you need to talk now
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">
              You don&apos;t have to wait for your next session. SADAG is free and open any time, day or night.
            </p>
            <a href="tel:0800567567" className="mt-3 inline-flex items-center gap-2 rounded-control bg-surface px-3 py-2 text-[13px] font-semibold text-accent shadow-sm transition-colors hover:bg-surface-hover">
              <Phone className="size-4" strokeWidth={2.2} aria-hidden /> SADAG · 0800 567 567
            </a>
            <p className="mt-2 text-[11px] text-text-3">In an emergency, call 10111 or go to your nearest hospital.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
