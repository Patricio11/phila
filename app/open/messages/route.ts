import { NextResponse, type NextRequest } from "next/server";
import { requireMessagingPrincipal } from "@/lib/messaging/principal";

/**
 * Batch 4m - one door for "open this conversation" links that don't know who
 * will click them (web push cards, crisis bells): sends a client to their
 * portal, a counsellor to /app, everyone else on staff to /hub. Not signed in
 * → the login page, then back here.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const q = t ? `?t=${encodeURIComponent(t)}` : "";
  try {
    const me = await requireMessagingPrincipal();
    if (me.kind === "client") return NextResponse.redirect(new URL("/me/messages", req.url));
    const base = me.teamRole === "counsellor" ? "/app/messages" : "/hub/messages";
    return NextResponse.redirect(new URL(`${base}${q}`, req.url));
  } catch {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/open/messages${q}`)}`, req.url));
  }
}
