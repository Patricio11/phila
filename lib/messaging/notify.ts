import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appointments, clients, counsellors, services, orgs, user } from "@/db/schema";
import { deliver } from "@/lib/messaging/deliver";
import { notifyCounsellor, notifyClientUser } from "@/db/queries/notifications";
import { sendPlatformEmail } from "@/lib/email/platform-email";
import { appointmentBookedCounsellorEmail } from "@/lib/email/templates";
import { videoJoinPath } from "@/lib/video/livekit";

const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
import { offerFreedSlotDb } from "@/db/queries/waitlist";
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
 * Waitlist offer (W7): tell a waiting client that a slot has opened. Fires the
 * `waitlist_slot` message over their preferred channel (dormant-safe) AND an always-on
 * in-app notification. Never throws — a failed offer must not break the cancellation.
 */
export async function notifyWaitlistOffer(clientId: string, orgId: string, slot: { counsellorName: string; startsAt: Date; serviceName: string }): Promise<void> {
  try {
    const [c] = await getDb().select({ name: clients.name, phone: clients.phone, email: clients.email }).from(clients).where(eq(clients.id, clientId)).limit(1);
    const [o] = await getDb().select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!c) return;
    await deliver({
      orgId, trigger: "waitlist_slot", ref: `waitlist:${clientId}:${slot.startsAt.getTime()}`,
      recipient: { phone: c.phone, email: c.email, preferredContact: null },
      vars: {
        clientName: (c.name ?? "there").split(" ")[0] ?? "there",
        practiceName: o?.name ?? "your practice",
        serviceName: slot.serviceName,
        counsellorName: slot.counsellorName.split(" ")[0] ?? slot.counsellorName,
        date: fmtLong(slot.startsAt),
        time: fmtTime(slot.startsAt),
      },
    });
    await notifyClientUser(clientId, orgId, {
      kind: "waitlist_offer",
      title: "A slot has opened",
      body: `${slot.counsellorName.split(" ")[0]} has a slot on ${fmtLong(slot.startsAt)} at ${fmtTime(slot.startsAt)} — contact us to take it.`,
      href: "/me",
    });
  } catch {
    /* an offer must never break the cancellation that freed the slot */
  }
}

/**
 * When a session is cancelled and the slot frees up, offer it to the waitlist (W7):
 * matching waiting clients (same counsellor, or counsellor-agnostic) are messaged the
 * freed slot, and the counsellor is told how many were offered it. Returns the count.
 * Best-effort — never throws (the cancellation has already happened).
 */
export async function offerFreedSlot(orgId: string, appointmentId: string): Promise<number> {
  try {
    const [row] = await getDb()
      .select({ counsellorId: appointments.counsellorId, startsAt: appointments.startsAt, counsellorName: counsellors.name, serviceName: services.name })
      .from(appointments)
      .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!row) return 0;
    const matches = await offerFreedSlotDb(orgId, row.counsellorId);
    if (matches.length === 0) return 0;
    const slot = { counsellorName: row.counsellorName ?? "your counsellor", startsAt: row.startsAt, serviceName: row.serviceName ?? "session" };
    for (const m of matches) await notifyWaitlistOffer(m.clientId, orgId, slot);
    await notifyCounsellor(row.counsellorId, {
      kind: "waitlist_offered",
      title: `Slot offered to ${matches.length} on the waitlist`,
      body: `A freed slot on ${fmtLong(row.startsAt)} was offered to ${matches.length} waiting client${matches.length === 1 ? "" : "s"}.`,
      href: "/hub/appointments",
    });
    return matches.length;
  } catch {
    return 0;
  }
}

/**
 * Full fan-out when an appointment is booked (Phase 17.2, upgraded W-feedback).
 * The CLIENT is reached on their preferred channel — WhatsApp first when the org
 * has its number live (free in-window), else SMS/email — with a guaranteed email
 * fallback if the text leg couldn't send, plus an in-app notice. The COUNSELLOR
 * gets a branded email AND an in-app notice. Online sessions carry the secure
 * join link everywhere. One lookup, never throws.
 */
export async function notifyAppointmentBooked(appointmentId: string): Promise<void> {
  try {
    const [row] = await getDb()
      .select({ a: appointments, clientName: clients.name, clientPhone: clients.phone, clientEmail: clients.email, clientProfile: clients.profile, counsellorName: counsellors.name, counsellorEmail: user.email, serviceName: services.name, orgName: orgs.name })
      .from(appointments)
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(counsellors, eq(appointments.counsellorId, counsellors.id))
      .leftJoin(user, eq(counsellors.userId, user.id))
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(orgs, eq(appointments.orgId, orgs.id))
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!row) return;
    const start = row.a.startsAt;
    const clientFirst = (row.clientName ?? "the client").split(" ")[0] ?? "the client";
    const when = `${fmtLong(start)} at ${fmtTime(start)}`;
    const isOnline = row.a.type === "online";
    const where = isOnline ? "online (secure video)" : "in person";
    const joinLink = isOnline ? `${APP_URL}${videoJoinPath(appointmentId, start.toISOString())}` : undefined;
    const vars = {
      clientName: clientFirst, practiceName: row.orgName ?? "your practice", serviceName: row.serviceName ?? "session",
      counsellorName: (row.counsellorName ?? "your counsellor").split(" ")[0] ?? "your counsellor", date: fmtDate(start), time: fmtTime(start),
      joinLink,
    };

    // 1) Client — their preferred channel through the rail. No stated preference →
    // the rail's fallback order (WhatsApp when the org's number is live → SMS → email).
    const preferred = (row.clientProfile as Record<string, string> | null)?.preferredContact ?? null;
    const outcome = await deliver({
      orgId: row.a.orgId,
      trigger: "booked",
      ref: appointmentId,
      recipient: { phone: row.clientPhone, email: row.clientEmail, preferredContact: preferred },
      vars,
    });

    // 1b) Guarantee: if a text channel was chosen but nothing actually sent (window
    // closed, no credit, provider error…), the confirmation still lands by email.
    if (outcome.channel !== "email" && outcome.status !== "sent" && row.clientEmail) {
      await deliver({
        orgId: row.a.orgId,
        trigger: "booked",
        ref: `${appointmentId}:email-fallback`,
        recipient: { phone: null, email: row.clientEmail, preferredContact: "Email" },
        vars,
      });
    }

    // 2) Counsellor — always-on in-app.
    await notifyCounsellor(row.a.counsellorId, {
      kind: "appointment_booked",
      title: `New session with ${row.clientName ?? "a client"}`,
      body: `${row.serviceName ?? "Session"} · ${when} · ${where}`,
      href: `/app/sessions/${appointmentId}`,
    });

    // 2b) Counsellor — a branded email too (with the join link when online), so a
    // new session isn't missed when they're away from the app. Best-effort.
    if (row.counsellorEmail) {
      try {
        await sendPlatformEmail({
          to: row.counsellorEmail,
          ...appointmentBookedCounsellorEmail({
            counsellorName: row.counsellorName, clientName: row.clientName ?? "A client",
            serviceName: row.serviceName ?? "Session", when, where, practiceName: row.orgName ?? "your practice",
            openUrl: `${APP_URL}/app/sessions/${appointmentId}`, joinUrl: joinLink,
          }),
        });
      } catch { /* email is best-effort; the in-app notice already landed */ }
    }

    // 3) Client — in-app too, if they have a portal account.
    await notifyClientUser(row.a.clientId, row.a.orgId, {
      kind: "appointment_booked",
      title: `Your session is booked`,
      body: `${row.serviceName ?? "Session"} · ${when} · ${where}${isOnline ? " · join from your portal" : ""}`,
      href: `/me/sessions`,
    });
  } catch {
    /* never break the action */
  }
}
