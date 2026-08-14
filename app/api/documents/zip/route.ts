import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, documentFolders } from "@/db/schema";
import { getCurrentPrincipal, activeMembership } from "@/lib/auth/session";
import { logAccess } from "@/lib/audit";
import { fetchAndZip, zipFileName } from "@/lib/zip/fetch-zip";

export const dynamic = "force-dynamic";

/**
 * Batch 3p - download a folder (or a selection) from the Documents manager as
 * one zip. Org-scoped and signed-in only; clean-scanned files only. The same
 * archive builder powers the emailed share link's "Download all".
 *   GET /api/documents/zip?folder=<id>
 *   GET /api/documents/zip?ids=<id,id,...>
 */
export async function GET(req: Request) {
  if (process.env.DATA_PROVIDER !== "db") return NextResponse.json({ error: "Not available." }, { status: 404 });
  const principal = await getCurrentPrincipal();
  const membership = principal ? activeMembership(principal) : null;
  if (!principal || !membership) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const url = new URL(req.url);
  const folderId = url.searchParams.get("folder");
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);

  const db = getDb();
  let label = "Documents";
  const wanted = new Set(ids);
  if (folderId) {
    const [f] = await db.select({ name: documentFolders.name }).from(documentFolders)
      .where(and(eq(documentFolders.id, folderId), eq(documentFolders.orgId, membership.orgId))).limit(1);
    if (!f) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    label = f.name;
    const inFolder = await db.select({ id: documents.id }).from(documents)
      .where(and(eq(documents.orgId, membership.orgId), eq(documents.folderId, folderId), isNull(documents.deletedAt)));
    for (const d of inFolder) wanted.add(d.id);
  }
  if (wanted.size === 0) return NextResponse.json({ error: "Nothing to zip." }, { status: 400 });

  const rows = await db.select().from(documents)
    .where(and(eq(documents.orgId, membership.orgId), inArray(documents.id, [...wanted])));
  const files = rows
    .filter((d) => !d.deletedAt && d.storageKey && d.scanStatus === "clean")
    .map((d) => ({ name: d.name, bytes: d.bytes, storageKey: d.storageKey!, storageProvider: d.storageProvider }));
  if (files.length === 0) return NextResponse.json({ error: "The selection holds no downloadable files (links and unscanned files can't be zipped)." }, { status: 400 });

  const res = await fetchAndZip(files);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 503 });

  await logAccess({
    action: "file.access",
    actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole },
    orgId: membership.orgId,
    target: folderId ? `folder:${folderId}` : `documents:${files.length}`,
    reason: "zip_download",
    meta: { files: res.included },
  });

  return new NextResponse(Buffer.from(res.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFileName(label)}"`,
      "Cache-Control": "no-store",
    },
  });
}
