import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-provider";
import { recordPageEvent } from "@/db/queries/public-page";

export const dynamic = "force-dynamic";

/**
 * PII-free public-page analytics sink (Phase 17). Accepts only `view` events from
 * the page beacon (book_click + booked are recorded server-side on those flows).
 * No visitor data is stored  just {orgId, kind, at}.
 */
export async function POST(req: Request) {
  let payload: { slug?: string; kind?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (payload.kind !== "view" || typeof payload.slug !== "string") return NextResponse.json({ ok: true });
  try {
    const provider = await getDataProvider();
    const org = await provider.getOrgBySlug(payload.slug);
    if (org) await recordPageEvent(org.id, "view");
  } catch {
    /* never fail a beacon */
  }
  return NextResponse.json({ ok: true });
}
