import { NextResponse } from "next/server";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { getMemberPhotoDb } from "@/db/queries/team";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Batch 2n - a member's profile photo, by user id.
 *
 * The bytes live in private storage, so this redirects to a short-lived signed
 * URL rather than proxying them. Access is a practice matter: you must be
 * signed in and share an org with the member. That keeps every `<img>` in the
 * app a plain URL - no signed links threaded through pages, no public bucket.
 * 404 when there is no photo, so the caller falls back to coloured initials.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const principal = await getCurrentPrincipal();
  if (!principal) return new NextResponse("Not signed in", { status: 401 });

  // Their own photo, or a photo from a practice they belong to.
  const orgIds = principal.memberships.map((m) => m.orgId);
  if (orgIds.length === 0) return new NextResponse("No practice", { status: 403 });

  let key: string | null = null;
  for (const orgId of orgIds) {
    const photo = await getMemberPhotoDb(orgId, userId);
    if (photo.key) { key = photo.key; break; }
  }
  if (!key) return new NextResponse("No photo", { status: 404 });

  const storage = await getStorageProvider();
  if (storage.status !== "live") return new NextResponse("Storage off", { status: 503 });
  let url: string;
  try {
    url = await storage.signedDownloadUrl(key, 3600);
  } catch {
    return new NextResponse("Storage error", { status: 502 });
  }
  // Private cache only: the URL is signed and personal to this viewer's session.
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
}
