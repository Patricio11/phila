import { requireSuperAdmin } from "@/lib/auth/guard";
import { getDb } from "@/db/client";
import { orgs } from "@/db/schema";
import { listBreachesDb } from "@/db/queries/breaches";
import { SUB_PROCESSORS } from "@/lib/compliance/subprocessors";
import { PageHead } from "@/components/shell/page-head";
import { Card, CardHead } from "@/components/ui/card";
import { BreachBoard } from "@/components/admin/breach-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compliance" };

/**
 * Phase 31.3/31.4 — the platform compliance console: the s22 breach register and
 * the sub-processor/DPA register every org inherits (read-only, in their pack).
 */
export default async function AdminCompliancePage() {
  await requireSuperAdmin();
  const [breaches, orgRows] = await Promise.all([
    listBreachesDb(),
    getDb().select({ id: orgs.id, name: orgs.name }).from(orgs),
  ]);

  return (
    <div className="rise space-y-6">
      <PageHead title="Compliance" summary="The POPIA house — breach register + the sub-processor chain orgs inherit." />

      <Card>
        <CardHead title="Breach register (POPIA s22)" count={breaches.length} />
        <div className="px-[17px] pb-[17px]">
          <BreachBoard breaches={breaches} orgs={orgRows} />
        </div>
      </Card>

      <Card>
        <CardHead title="Sub-processor / operator register" count={SUB_PROCESSORS.length} />
        <div className="px-[17px] pb-[17px]">
          <p className="mb-3 text-[12.5px] text-text-3">Maintained once here; every org inherits it read-only and it prints inside their POPIA pack. A change is a one-line code edit (lib/compliance/subprocessors.ts).</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-3">
                  <th className="py-2 pr-3 font-semibold">Provider</th>
                  <th className="py-2 pr-3 font-semibold">Service</th>
                  <th className="py-2 pr-3 font-semibold">Data</th>
                  <th className="py-2 pr-3 font-semibold">Cross-border basis (s72)</th>
                  <th className="py-2 font-semibold">Dormant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text-2">
                {SUB_PROCESSORS.map((s) => (
                  <tr key={s.name}>
                    <td className="py-2 pr-3 font-medium text-text">{s.name}</td>
                    <td className="py-2 pr-3">{s.service}</td>
                    <td className="py-2 pr-3">{s.dataCategories}</td>
                    <td className="py-2 pr-3">{s.crossBorder ?? "Stays in South Africa"}</td>
                    <td className="py-2">{s.dormantByDefault ? "Until switched on" : "Core"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
