import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { logAccess } from "@/lib/audit";
import { resolveNoteAccess } from "@/lib/auth/roles";
import { SessionEditor } from "@/components/workspace/session-editor";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();

  const now = clockNow();
  const [counsellors, org] = await Promise.all([
    provider.listCounsellors(membership.orgId),
    provider.getOrg(membership.orgId),
  ]);
  const me = counsellors.find((c) => c.userId === principal.userId);
  const data = await provider.getSession(id, now);
  if (!me || !data || data.appointment.orgId !== membership.orgId) notFound();

  // Clinical-note access decision (Care-Confidentiality Rule). The author and
  // their supervisor read freely; anyone else would be an audited override.
  const author = counsellors.find((c) => c.id === data.appointment.counsellorId);
  const access = resolveNoteAccess({
    role: membership.teamRole,
    isAuthor: data.appointment.counsellorId === me.id,
    isSupervisorOfAuthor: me.isSupervisor && author?.supervisorId === me.id,
  });
  if (!access.allowed) notFound();

  await logAccess({
    action: access.audited ? "note.read_hub_override" : "note.read",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: `appointment:${id}/note`,
    reason: access.reason,
  });

  return <SessionEditor data={data} counsellorName={me.name} videoEnabled={Boolean(org?.features.video)} />;
}
