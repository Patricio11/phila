import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { PageHead } from "@/components/shell/page-head";
import { AuditTable } from "@/components/admin/audit-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit" };

export default async function AdminAuditPage() {
  const principal = await requireSuperAdmin();
  const provider = await getDataProvider();
  const events = await provider.listPlatformAudit();

  await logAccess({
    action: "admin.action",
    actor: { userId: principal.userId, platformRole: "super_admin", teamRole: null },
    orgId: null,
    target: "platform/audit",
    reason: "view_audit_ledger",
  });

  return (
    <div className="rise space-y-6">
      <PageHead
        title="Audit"
        summary="Every PII access and privileged action across the platform — the ledger you can show the Information Regulator."
      />
      <AuditTable events={events} />
    </div>
  );
}
