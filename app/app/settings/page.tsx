import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { MyProfileForm, type MyProfile } from "@/components/settings/my-profile-form";
import { SecuritySettings } from "@/components/hub/security-settings";
import { Preferences } from "@/components/settings/preferences";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const DOW = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function CounsellorSettingsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const now = clockNow();
  const detail = await provider.getTeamMemberDetail(membership.orgId, principal.userId, now);
  if (!detail) notFound();

  // Feedback #5 - read-only: only the practice can change availability.
  const availability = detail.counsellorId && process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/availability")).getCounsellorAvailabilityDb(membership.orgId, detail.counsellorId)
    : [];

  const p = detail.profile;
  const profile: MyProfile = {
    name: detail.member.name,
    email: detail.member.email,
    phone: p?.phone ?? "",
    dateOfBirth: p?.dateOfBirth ?? "",
    address: p?.address ?? "",
    languages: p?.languages.join(", ") ?? "",
    bio: p?.bio ?? "",
  };

  return (
    <div className="rise space-y-6">
      <PageHead title="Settings" summary="Your profile, security, and preferences." />

      <Card>
        <CardHead title="Your profile" />
        <div className="px-[17px] pb-[17px]">
          <MyProfileForm initial={profile} credential={detail.member.credential} registrationNo={detail.registrationNo} />
        </div>
      </Card>

      {detail.counsellorId && (
        <Card>
          <CardHead title="Your availability" />
          <div className="px-[17px] pb-[17px]">
            {availability.length > 0 ? (
              <ul className="space-y-1.5">
                {availability.map((w, i) => (
                  <li key={i} className="flex items-center gap-3 text-[13px]">
                    <span className="w-24 shrink-0 text-text">{DOW[w.weekday]}</span>
                    <span className="tabular-nums text-text-2">{w.start} – {w.end}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-text-2">You follow the practice working hours.</p>
            )}
            <p className="mt-3 text-[11.5px] leading-relaxed text-text-3">
              Availability is managed by your practice - ask an admin if this needs to change.
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Security" />
          <div className="px-[17px] pb-[17px]">
            <SecuritySettings initialTwoFactor={principal.twoFactorEnabled} />
          </div>
        </Card>

        <Card>
          <CardHead title="Preferences" />
          <div className="px-[17px] pb-[17px]">
            <Preferences />
          </div>
        </Card>
      </div>
    </div>
  );
}
