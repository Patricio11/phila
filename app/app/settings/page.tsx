import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CredentialChip } from "@/components/ui/credential-chip";
import { Preferences } from "@/components/settings/preferences";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function CounsellorSettingsPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  return (
    <div className="rise space-y-6">
      <PageHead title="Settings" summary="Your profile and preferences." />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHead title="Profile" />
          <div className="flex flex-col items-center px-[17px] pb-[17px] text-center">
            <Avatar name={me.name} size="lg" verified={me.credential.status === "verified"} />
            <div className="mt-3 text-[15px] font-[640] text-text">{me.name}</div>
            <div className="text-[12.5px] text-text-3">{principal.email}</div>
            <div className="mt-2.5">
              <CredentialChip body={me.credential.body} status={me.credential.status} />
            </div>
            {me.credential.registrationNo && (
              <div className="mt-2 text-[11.5px] text-text-3">Reg. {me.credential.registrationNo}</div>
            )}
            {membership.isSupervisor && <div className="mt-1 text-[11.5px] text-accent">Supervisor</div>}
          </div>
        </Card>

        <Preferences />
      </div>
    </div>
  );
}
