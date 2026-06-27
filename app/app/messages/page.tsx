import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/guard";
import { getDataProvider } from "@/lib/data-provider";
import { PageHead } from "@/components/shell/page-head";
import { MessagesView } from "@/components/messages/messages-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { principal, membership } = await requireOrg(["counsellor"]);
  const provider = await getDataProvider();
  const counsellors = await provider.listCounsellors(membership.orgId);
  const me = counsellors.find((c) => c.userId === principal.userId);
  if (!me) notFound();

  const conversations = await provider.listConversations(me.id);

  return (
    <div className="rise space-y-5">
      <PageHead title="Messages" summary="Your conversations with clients — WhatsApp-first when it's live." />
      <MessagesView conversations={conversations} />
    </div>
  );
}
