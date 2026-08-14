import { NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage";
import { logAccess } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Batch 3p - one file off an emailed share link: validate the token, then
 * redirect to a short-TTL signed URL. Every download is counted and audited.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await ctx.params;
  if (process.env.DATA_PROVIDER !== "db") return NextResponse.json({ error: "Not available." }, { status: 404 });

  const { getShareForTokenDb, recordShareDownloadDb } = await import("@/db/queries/share-links");
  const view = await getShareForTokenDb(token);
  if (!view || view.revoked || view.expired) return NextResponse.json({ error: "This link is no longer valid." }, { status: 404 });

  const doc = view.docs.find((d) => d.id === docId);
  if (!doc || !doc.storageKey) return NextResponse.json({ error: "That file isn't on this link." }, { status: 404 });

  let url: string;
  try {
    const storage = await getStorageProvider(doc.storageProvider as never);
    if (storage.status !== "live") throw new Error("storage off");
    url = await storage.signedDownloadUrl(doc.storageKey);
  } catch {
    return NextResponse.json({ error: "The practice's file storage isn't reachable right now - please try again later." }, { status: 503 });
  }

  await recordShareDownloadDb(view.id);
  await logAccess({
    action: "file.access",
    actor: { userId: `public:share_${view.id}`, platformRole: null, teamRole: null },
    orgId: view.orgId,
    target: `document:${doc.id}`,
    reason: "share_link_download",
  });
  return NextResponse.redirect(url, 302);
}
