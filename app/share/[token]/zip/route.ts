import { NextResponse } from "next/server";
import { logAccess } from "@/lib/audit";
import { fetchAndZip, zipFileName } from "@/lib/zip/fetch-zip";

export const dynamic = "force-dynamic";

/**
 * Batch 3p - "Download all as .zip" on an emailed share link. Everything the
 * link holds (files only; external links can't be zipped) lands in one
 * archive, named after the shared folder when there is one.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (process.env.DATA_PROVIDER !== "db") return NextResponse.json({ error: "Not available." }, { status: 404 });

  const { getShareForTokenDb, recordShareDownloadDb } = await import("@/db/queries/share-links");
  const view = await getShareForTokenDb(token);
  if (!view || view.revoked || view.expired) return NextResponse.json({ error: "This link is no longer valid." }, { status: 404 });

  const files = view.docs.filter((d) => d.storageKey).map((d) => ({
    name: d.name, bytes: d.bytes, storageKey: d.storageKey!, storageProvider: d.storageProvider,
  }));
  if (files.length === 0) return NextResponse.json({ error: "This link holds no downloadable files." }, { status: 404 });

  const res = await fetchAndZip(files);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 503 });

  await recordShareDownloadDb(view.id);
  await logAccess({
    action: "file.access",
    actor: { userId: `public:share_${view.id}`, platformRole: null, teamRole: null },
    orgId: view.orgId,
    target: `share_link:${view.id}`,
    reason: "share_link_zip_download",
    meta: { files: res.included },
  });

  const name = zipFileName(view.folderName ?? `${view.orgName} files`);
  return new NextResponse(Buffer.from(res.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
