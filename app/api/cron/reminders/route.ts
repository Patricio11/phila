import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments } from "@/db/schema";
import { notifyAppointment } from "@/lib/messaging/notify";
import { now as clockNow } from "@/lib/clock";

export const dynamic = "force-dynamic";

/**
 * Reminder sweep (Phase 12.4). Sends a T-24h and a T-1h reminder for upcoming
 * scheduled sessions, each exactly once (the reminded_24h/reminded_1h flags make
 * it idempotent regardless of how often the cron runs).
 *
 * Auth **fails closed in production**: a `CRON_SECRET` is required and the bearer
 * must match, or the endpoint refuses. It only stays open (for local testing) when
 * the secret is unset AND we're not in production  otherwise a missing env var
 * would leave a public endpoint that fans out real, paid reminders on demand.
 */
async function sweep(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "cron not configured" }, { status: 503 });
    }
    // dev only: open so the sweep is testable without a secret.
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const nowMs = new Date(clockNow()).getTime();
  const at = (hours: number) => new Date(nowMs + hours * 3_600_000);

  let reminders24h = 0;
  const due24 = await db.select().from(appointments).where(and(eq(appointments.state, "scheduled"), eq(appointments.reminded24h, false), gte(appointments.startsAt, at(20)), lte(appointments.startsAt, at(25))));
  for (const a of due24) {
    await notifyAppointment(a.id, "reminder", null, "24h");
    await db.update(appointments).set({ reminded24h: true }).where(eq(appointments.id, a.id));
    reminders24h++;
  }

  let reminders1h = 0;
  const due1 = await db.select().from(appointments).where(and(eq(appointments.state, "scheduled"), eq(appointments.reminded1h, false), gte(appointments.startsAt, at(0)), lte(appointments.startsAt, at(1.5))));
  for (const a of due1) {
    await notifyAppointment(a.id, "reminder", null, "1h");
    await db.update(appointments).set({ reminded1h: true }).where(eq(appointments.id, a.id));
    reminders1h++;
  }

  return NextResponse.json({ ok: true, reminders24h, reminders1h });
}

export const POST = sweep;
export const GET = sweep;
