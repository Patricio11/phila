"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { logAccess } from "@/lib/audit";
import { requireOrg } from "@/lib/auth/guard";
import { getDb } from "@/db/client";
import { orgs } from "@/db/schema";
import { createAppointment as persistCreateAppointment } from "@/db/queries/appointments";
import { createClientDb } from "@/db/queries/clients";
import { isSlotTakenError, SLOT_TAKEN_MESSAGE } from "@/db/queries/errors";
import { notifyAppointmentBooked } from "@/lib/messaging/notify";
import { now as clockNow } from "@/lib/clock";
import type { Province } from "@/lib/domain/enums";

const BOOKERS = ["counsellor", "org_admin", "front_desk"] as const;

/**
 * Create a client inline from the booking modal (Phase 17.2). The chosen counsellor
 * becomes the client's primary counsellor; province defaults to the org's. Returns
 * the new client so the modal can select it immediately.
 */
const newClientInput = z.object({
  orgId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the client's full name.").max(120),
  phone: z.string().trim().max(24).default(""),
  email: z.string().trim().max(160).default(""),
  counsellorId: z.string().min(1, "Pick a counsellor first."),
});

export async function createClientForBooking(
  raw: z.input<typeof newClientInput>,
): Promise<{ ok: true; client: { id: string; name: string } } | { ok: false; error: string }> {
  const { principal, membership } = await requireOrg([...BOOKERS]);
  const parsed = newClientInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the client's details." };
  const d = parsed.data;
  if (d.orgId !== membership.orgId) return { ok: false, error: "Wrong practice." };
  if (!d.phone && !d.email) return { ok: false, error: "Add a phone number or an email." };
  if (d.phone && !/^(\+27|0)\d{9}$/.test(d.phone.replace(/\s/g, ""))) return { ok: false, error: "Use a SA number, e.g. 082 123 4567." };
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return { ok: false, error: "Enter a valid email." };

  const [org] = await getDb().select({ province: orgs.province }).from(orgs).where(eq(orgs.id, d.orgId)).limit(1);
  const { id } = await createClientDb(
    d.orgId,
    { name: d.name, phone: d.phone || undefined, email: d.email || undefined, province: (org?.province ?? "Gauteng") as Province, counsellorId: d.counsellorId, riskFlag: false },
    clockNow(),
  );
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: membership.teamRole }, orgId: d.orgId, target: `client:new/${id}`, reason: "create_client_inline_booking" });
  return { ok: true, client: { id, name: d.name.trim() } };
}

/**
 * Create an appointment (mock). Validates + audits and returns a confirmation
 * without persisting (Mock-First). Phase 11 wires the real scheduling engine
 * (room/counsellor conflict checks, recurring generation) behind this shape;
 * Phase 12 sends the confirmation. No message fires here.
 */
const input = z.object({
  orgId: z.string().min(1),
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  counsellorId: z.string().min(1),
  type: z.enum(["online", "in_person"]),
  roomId: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().positive().max(600),
  recurring: z.boolean(),
  /** Weeks in the series; null = ongoing/indefinite. Only used when recurring. */
  recurringCount: z.number().int().min(1).max(52).nullable().optional(),
  notes: z.string().max(1000).optional(),
  sendConfirmation: z.boolean(),
});

export async function createAppointment(
  raw: z.infer<typeof input>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please complete the appointment details." };
  const data = parsed.data;
  if (data.type === "in_person" && !data.roomId)
    return { ok: false, error: "Pick a room for an in-person session." };

  if (process.env.DATA_PROVIDER === "db") {
    let firstId: string;
    try {
      ({ firstId } = await persistCreateAppointment({
        orgId: data.orgId, clientId: data.clientId, serviceId: data.serviceId, counsellorId: data.counsellorId,
        type: data.type, roomId: data.roomId, date: data.date, time: data.time, durationMin: data.durationMin,
        recurring: data.recurring, recurringCount: data.recurringCount ?? null,
      }));
    } catch (e) {
      if (isSlotTakenError(e)) return { ok: false, error: SLOT_TAKEN_MESSAGE };
      throw e;
    }
    // In-app (always) + email (rail); the first session of a series carries the notice.
    if (data.sendConfirmation) await notifyAppointmentBooked(firstId);
  }

  await logAccess({
    action: "admin.action",
    actor: { userId: "scheduler", platformRole: null, teamRole: "counsellor" },
    orgId: data.orgId,
    target: `appointment:new/${data.clientId}`,
    reason: data.recurring ? `create_recurring:${data.recurringCount ?? "ongoing"}` : "create_appointment",
  });

  return { ok: true };
}
