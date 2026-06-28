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

export default async function CounsellorSettingsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const now = clockNow();
  const detail = await provider.getTeamMemberDetail(membership.orgId, principal.userId, now);
  if (!detail) notFound();

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
