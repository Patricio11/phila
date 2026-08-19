import { NextResponse, type NextRequest } from "next/server";
import { requireMessagingPrincipal } from "@/lib/messaging/principal";
import { stampTypingDb, typingNowDb } from "@/db/queries/messages";

/**
 * Batch 4m - the typing indicator's own little door. A plain fetch, not a
 * server action, because server actions from one page run one after another
 * (a 2.5 s typing poll would queue behind the 5 s thread refresh and arrive
 * late). GET = who's typing in my threads right now; POST = I'm typing here.
 * Members only; never the text; nothing is stored beyond one timestamp.
 */
const isDb = () => process.env.DATA_PROVIDER === "db";

export async function GET() {
  try {
    const me = await requireMessagingPrincipal();
    if (!isDb()) return NextResponse.json({ ok: true, typing: {} });
    return NextResponse.json({ ok: true, typing: await typingNowDb(me.userId, me.orgId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireMessagingPrincipal();
    const body = (await req.json().catch(() => ({}))) as { threadId?: string };
    const threadId = String(body.threadId ?? "");
    if (isDb() && threadId && !threadId.startsWith("local_")) await stampTypingDb(threadId, me.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
