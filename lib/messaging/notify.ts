import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments, clients, counsellors, services, orgs } from "@/db/schema";
import { deliver } from "@/lib/messaging/deliver";
import { notifyCounsellor, notifyClientUser } from "@/db/queries/notifications";
import type { MessageTrigger } from "@/lib/messaging/templates";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short" }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const fmtLong = (d: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long" }).format(d);

/**
 * Fire the notification for an appointment event. Looks up the recipient + the
 * template variables, then routes through the deliver chokepoint. Never throws 
 * a notification failure must not break the booking/scheduling action that
 * triggered it (the message_log records any failure honestly).
 */
export async function notifyAppointment(appointmentId: string, trigger: MessageTrigger, preferredContact?: string | null, refSuffix?: string): Promise<void> {
  try {
    const [row] = await getDb()
      .select({
        a: appointments,
        clientName: clients.name, clientPhone: clients.phone, clientEmail: clients.email,
        counsellorName: counsellors.name, serviceName: services.name, orgName: orgs.name,
      })
      .from(appointments)
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(orgs, eq(appointments.orgId, orgs.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!row) return;
    const start = row.a.startsAt;
    await deliver({
      orgId: row.a.orgId,
      trigger,
      ref: refSuffix ? `${appointmentId}:${refSuffix}` : appointmentId,
      recipient: { phone: row.clientPhone, email: row.clientEmail, preferredContact: preferredContact ?? null },
      vars: {
        clientName: (row.clientName ?? "there").split(" ")[0] ?? "there",
        practiceName: row.orgName ?? "your practice",
        serviceName: row.serviceName ?? "session",
        counsellorName: (row.counsellorName ?? "your counsellor").split(" ")[0] ?? "your counsellor",
        date: fmtDate(start),
        time: fmtTime(start),
      },
    });
  } catch {
    /* notifications never break the action; failures are visible in message_log */
  }
}

/**
 * Full fan-out when an appointment is booked (Phase 17.2). Defaults to **email +
 * in-app** (SMS is opt-in): the client gets an email via the rail (dormant-safe),
 * and both the counsellor and the client (if they have a portal account) get an
 * always-on in-app notification. One lookup, never throws.
 */
export async function notifyAppointmentBooked(appointmentId: string): Promise<void> {
  try {
    const [row] = await getDb()
      .select({ a: appointments, clientName: clients.name, clientPhone: clients.phone, clientEmail: clients.email, counsellorName: counsellors.name, serviceName: services.name, orgName: orgs.name })
      .from(appointments)
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(orgs, eq(appointments.orgId, orgs.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!row) return;
    const start = row.a.startsAt;
    const clientFirst = (row.clientName ?? "the client").split(" ")[0] ?? "the client";
    const when = `${fmtLong(start)} at ${fmtTime(start)}`;
    const where = row.a.type === "online" ? "online (secure video)" : "in person";

    // 1) Client — email-first through the rail (SMS stays opt-in).
    await deliver({
      orgId: row.a.orgId,
      trigger: "booked",
      ref: appointmentId,
      recipient: { phone: row.clientPhone, email: row.clientEmail, preferredContact: "Email" },
      vars: {
        clientName: clientFirst, practiceName: row.orgName ?? "your practice", serviceName: row.serviceName ?? "session",
        counsellorName: (row.counsellorName ?? "your counsellor").split(" ")[0] ?? "your counsellor", date: fmtDate(start), time: fmtTime(start),
      },
    });

    // 2) Counsellor — always-on in-app.
    await notifyCounsellor(row.a.counsellorId, {
      kind: "appointment_booked",
      title: `New session with ${row.clientName ?? "a client"}`,
      body: `${row.serviceName ?? "Session"} · ${when} · ${where}`,
      href: `/app/sessions/${appointmentId}`,
    });

    // 3) Client — in-app too, if they have a portal account.
    await notifyClientUser(row.a.clientId, row.a.orgId, {
      kind: "appointment_booked",
      title: `Your session is booked`,
      body: `${row.serviceName ?? "Session"} · ${when} · ${where}`,
      href: `/me/sessions`,
    });
  } catch {
    /* never break the action */
  }
}
