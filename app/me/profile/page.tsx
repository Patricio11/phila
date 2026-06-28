import { notFound } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { requireClient } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { ClientProfileForm, type ClientProfile } from "@/components/client/client-profile-form";
import { SecuritySettings } from "@/components/hub/security-settings";
import { changeClientPassword, setClientTwoFactor } from "@/app/me/profile/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function MeProfilePage() {
  const { clientId } = await requireClient();
  const provider = await getDataProvider();
  const profile = await provider.getClientProfile(clientId);
  if (!profile) notFound();

  const initial: ClientProfile = {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    dateOfBirth: profile.dateOfBirth,
    address: profile.address,
    emergencyName: profile.emergencyName,
    emergencyPhone: profile.emergencyPhone,
    preferredContact: (["WhatsApp", "Phone call", "Email"].includes(profile.preferredContact) ? profile.preferredContact : "WhatsApp") as ClientProfile["preferredContact"],
  };

  return (
    <div className="rise space-y-5">
      <PageHead title="Your profile" summary="Keep your details up to date so we can reach you." />

      <Card>
        <CardHead title="Your details" />
        <div className="px-[17px] pb-[17px]">
          <ClientProfileForm initial={initial} />
        </div>
      </Card>

      <Card className="border-accent/20 bg-accent-soft/30 p-4">
        <div className="flex items-center gap-2 text-[13.5px] font-[640] text-text">
          <HeartHandshake className="size-4 text-accent" strokeWidth={2} aria-hidden /> Your care team
        </div>
        <p className="mt-1 text-[12.5px] text-text-2">
          You&apos;re cared for by <span className="font-medium text-text">{profile.counsellorName}</span>
          {profile.memberSince ? <> · with us since {new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "long", year: "numeric" }).format(new Date(profile.memberSince))}</> : null}.
        </p>
      </Card>

      <Card>
        <CardHead title="Sign-in & security" />
        <div className="px-[17px] pb-[17px]">
          <SecuritySettings initialTwoFactor={false} onChangePassword={changeClientPassword} onSetTwoFactor={setClientTwoFactor} />
        </div>
      </Card>
    </div>
  );
}
