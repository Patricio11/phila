import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { MyProfileForm, type MyProfile } from "@/components/settings/my-profile-form";
import { SecuritySettings } from "@/components/hub/security-settings";
import { PushOptIn } from "@/components/push/push-opt-in";
import { Preferences } from "@/components/settings/preferences";
import { MyAvailabilityCard } from "@/components/settings/my-availability-card";
import { now as clockNow } from "@/lib/clock";
import type { BusinessHours } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function CounsellorSettingsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const now = clockNow();
  const detail = await provider.getTeamMemberDetail(membership.orgId, principal.userId, now);
  if (!detail) notFound();

  // Batch 2n - the counsellor keeps their own hours; the practice is notified.
  const availability = detail.counsellorId && process.env.DATA_PROVIDER === "db"
    ? await (await import("@/db/queries/availability")).getCounsellorAvailabilityDb(membership.orgId, detail.counsellorId)
    : [];
  // Days off and default hours are the practice's - the editor seeds from them.
  const hasPhoto = process.env.DATA_PROVIDER === "db"
    ? Boolean((await (await import("@/db/queries/team")).getMemberPhotoDb(membership.orgId, principal.userId)).key)
    : false;
  const org = await provider.getOrg(membership.orgId);
  const orgHours: BusinessHours = org?.scheduling.businessHours ?? { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null };

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
          <MyProfileForm
            initial={profile}
            credential={detail.member.credential}
            registrationNo={detail.registrationNo}
            userId={principal.userId}
            hasPhoto={hasPhoto}
          />
        </div>
      </Card>

      {detail.counsellorId && (
        <Card>
          <CardHead title="Your availability" />
          <MyAvailabilityCard
            firstName={principal.name.split(" ")[0] ?? "You"}
            initial={availability}
            orgHours={orgHours}
          />
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

      {/* Batch 4m - web push on this device */}
      <Card>
        <CardHead title="Notifications" />
        <div className="px-[17px] pb-[17px]">
          <PushOptIn variant="row" />
        </div>
      </Card>
    </div>
  );
}
