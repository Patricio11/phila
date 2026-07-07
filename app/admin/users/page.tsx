import { requireSuperAdmin } from "@/lib/auth/guard";
import { listPlatformOperatorsDb, type PlatformOperator } from "@/db/queries/platform";
import { PageHead } from "@/components/shell/page-head";
import { OperatorsTable } from "@/components/admin/operators-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const principal = await requireSuperAdmin();
  const operators: PlatformOperator[] = process.env.DATA_PROVIDER === "db" ? await listPlatformOperatorsDb() : [];

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Platform users"
        summary="The operators who run Phila. Invite a colleague, resend a setup link, or revoke access — every change is audited."
      />
      <OperatorsTable operators={operators} selfUserId={principal.userId} />
    </div>
  );
}
