import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cake, CalendarClock, GraduationCap, Languages, Mail, MapPin, Phone, ShieldCheck, Users, Video } from "lucide-react";
import { requireHub } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { TEAM_ROLE_LABELS } from "@/lib/domain/enums";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { StatusDot } from "@/components/ui/status-dot";
import { CredentialChip } from "@/components/ui/credential-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamRoleChip, ROLE_REACH } from "@/components/hub/team-role-chip";
import { ManageMemberButton } from "@/components/hub/manage-member-modal";

export const dynamic = "force-dynamic";

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function age(dob: string, now: string): number {
  const b = new Date(dob);
  const n = new Date(now);
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  const m = n.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}
function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}
function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireHub();
  const provider = await getDataProvider();
  const now = new Date().toISOString();

  const detail = await provider.getTeamMemberDetail(membership.orgId, id, now);
  if (!detail) notFound();

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" },
    orgId: membership.orgId,
    target: `member:${id}`,
    reason: "view_member",
  });

  const { member, profile, stats, caseload, upcoming, roomSchedule } = detail;

  return (
    <div className="rise space-y-6">
      <Link href="/hub/team" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All team
      </Link>

      <PageHead
        title={
          <span className="flex items-center gap-2.5">
            <Avatar name={member.name} size="md" verified={member.credential?.status === "verified"} /> {member.name}
          </span>
        }
        summary={member.email}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2"><StatusDot tone={member.active ? "green" : "grey"} /> {member.active ? "Active" : "Deactivated"}</span>
            <ManageMemberButton member={member} label="Manage" />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TeamRoleChip role={member.teamRole} />
        {member.isSupervisor && <Tag tone="accent">Supervisor</Tag>}
        {member.credential && <CredentialChip body={member.credential.body} status={member.credential.status} />}
        {detail.registrationNo && <span className="text-[11.5px] text-text-3">Reg. {detail.registrationNo}</span>}
      </div>

      {/* Counsellor stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3.5">
          <Stat value={String(stats.caseload)} label="Active caseload" />
          <Stat value={String(stats.sessionsWeek)} label="Sessions this week" />
          <Stat value={String(stats.seenWeek)} label="Seen this week" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHead title="Personal & contact" />
            <dl className="grid gap-x-6 gap-y-3.5 px-[17px] pb-[17px] sm:grid-cols-2">
              <Info icon={Mail} label="Email" value={member.email} />
              <Info icon={Phone} label="Phone" value={profile?.phone ?? "—"} />
              <Info icon={Cake} label="Date of birth" value={profile ? `${longDate(profile.dateOfBirth)} · ${age(profile.dateOfBirth, now)}` : "—"} />
              <Info icon={Languages} label="Languages" value={profile?.languages.join(", ") ?? "—"} />
              <Info icon={MapPin} label="Address" value={profile?.address ?? "—"} className="sm:col-span-2" />
              <Info icon={CalendarClock} label="Joined" value={longDate(member.joinedAt)} />
            </dl>
            {profile?.bio && <p className="border-t border-border px-[17px] py-4 text-[13px] leading-relaxed text-text-2">{profile.bio}</p>}
          </Card>

          <Card>
            <CardHead title={<span className="flex items-center gap-2"><GraduationCap className="size-4 text-text-3" strokeWidth={2} aria-hidden /> Education & qualifications</span>} />
            <div className="space-y-3 px-[17px] pb-[17px]">
              {profile && profile.qualifications.length > 0 ? (
                profile.qualifications.map((q, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="text-[13.5px] font-medium text-text">{q.qualification}</div>
                      <div className="text-[12px] text-text-3">{q.institution}</div>
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-text-3">{q.year}</span>
                  </div>
                ))
              ) : (
                <p className="text-[12.5px] text-text-3">No qualifications on file.</p>
              )}
              {profile && profile.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.specialties.map((s) => <Tag key={s} tone="neutral">{s}</Tag>)}
                </div>
              )}
            </div>
          </Card>

          {caseload.length > 0 && (
            <Card>
              <CardHead title="Caseload" count={caseload.length} />
              <div className="grid gap-2 px-[17px] pb-[17px] sm:grid-cols-2">
                {caseload.map((c) => (
                  <Link key={c.id} href={`/hub/clients/${c.id}`} className="flex items-center gap-2.5 rounded-control border border-border p-2.5 transition-colors hover:bg-surface-hover">
                    <Avatar name={c.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text">{c.name}</span>
                    {c.riskFlag && <StatusDot tone="rose" />}
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: access + schedule */}
        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[13px] font-[600] text-text">
              <ShieldCheck className="size-4 text-accent" strokeWidth={2} aria-hidden /> Role & access
            </div>
            <div className="mt-2"><TeamRoleChip role={member.teamRole} /></div>
            <p className="mt-2 text-[12px] leading-relaxed text-text-2">{ROLE_REACH[member.teamRole]}</p>
            <p className="mt-2 text-[11.5px] text-text-3">Role on file: {TEAM_ROLE_LABELS[member.teamRole]}{member.isSupervisor ? " · supervisor" : ""}.</p>
            {detail.supervisorName && <p className="mt-1 text-[11.5px] text-text-3">Supervised by {detail.supervisorName}.</p>}
          </Card>

          {roomSchedule.length > 0 && (
            <Card>
              <CardHead title="Room schedule" action={<Link href="/hub/rooms" className="text-[12px] font-medium text-accent hover:underline">Edit</Link>} />
              <div className="space-y-2 px-[17px] pb-[17px]">
                {roomSchedule.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="font-medium text-text">{r.roomName}</span>
                    <span className="text-text-3">{r.days.map((d) => DOW[d]).join(" & ")} · {r.start}–{r.end}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {stats && (
            <Card>
              <CardHead title="Upcoming sessions" count={upcoming.length} />
              <div className="px-[17px] pb-[17px]">
                {upcoming.length > 0 ? (
                  <ul className="space-y-2">
                    {upcoming.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-[12.5px]">
                        <span className="w-32 shrink-0 tabular-nums text-text-3">{timeOf(a.startsAt)}</span>
                        <span className="min-w-0 flex-1 truncate text-text-2">{a.clientName}</span>
                        {a.type === "online" ? <Video className="size-3.5 shrink-0 text-info" strokeWidth={2} aria-hidden /> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={Users} title="Nothing booked" body="No upcoming sessions this window." />
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value, className }: { icon: typeof Mail; label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wide text-text-3">
        <Icon className="size-3.5" strokeWidth={2} aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] text-text">{value}</dd>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="text-[22px] font-bold tabular-nums text-text">{value}</div>
      <div className="truncate text-[12px] text-text-2">{label}</div>
    </div>
  );
}
