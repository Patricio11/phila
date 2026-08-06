import { CalendarPlus, CalendarX, CalendarClock, FileCheck2, Gavel, HandCoins, MessageSquareText, Pencil, Phone, ShieldCheck, UserPlus, Sparkles } from "lucide-react";
import type { ActivityRow } from "@/db/queries/hub-dashboard";

/**
 * Feedback #3 — the Activity feed: the org's own audit trail, worded like a
 * human. Reads (note/PII access) are deliberately excluded — this is "what
 * happened", not "who looked". Every row still lives, verbatim, in the audit log.
 */
type Meta = { icon: typeof Pencil; text: string };

const REASONS: Record<string, Meta> = {
  create_appointment: { icon: CalendarPlus, text: "New session booked" },
  reschedule_appointment: { icon: CalendarClock, text: "Session rescheduled" },
  cancel_appointment: { icon: CalendarX, text: "Session cancelled" },
  mark_no_show: { icon: CalendarX, text: "Session marked as a no-show" },
  add_client: { icon: UserPlus, text: "New client added" },
  invite_client: { icon: UserPlus, text: "Client invited to the portal" },
  merge_clients: { icon: UserPlus, text: "Duplicate clients merged" },
  mark_invoice_paid: { icon: HandCoins, text: "Invoice marked paid" },
  send_invoice_reminder: { icon: HandCoins, text: "Invoice reminder sent" },
  edit_public_page: { icon: Pencil, text: "Public page updated" },
  edit_template: { icon: MessageSquareText, text: "Message template edited" },
  update_notification_settings: { icon: MessageSquareText, text: "Messaging settings updated" },
  connect_whatsapp: { icon: MessageSquareText, text: "WhatsApp connection updated" },
  request_reschedule: { icon: CalendarClock, text: "A client asked to reschedule" },
  request_cancel: { icon: CalendarX, text: "A client asked to cancel" },
  dsar_request_export: { icon: ShieldCheck, text: "A client requested a copy of their data" },
  dsar_request_deletion: { icon: ShieldCheck, text: "A client requested deletion of their data" },
  data_subject_access_request: { icon: FileCheck2, text: "Data export generated (POPIA)" },
  data_subject_deletion_request: { icon: ShieldCheck, text: "Deletion request actioned" },
  legal_hold_set: { icon: Gavel, text: "Legal hold placed" },
  legal_hold_lifted: { icon: Gavel, text: "Legal hold lifted" },
  popia_pack_generated: { icon: FileCheck2, text: "POPIA compliance pack generated" },
  note_signed: { icon: FileCheck2, text: "Clinical note signed" },
  sign_note: { icon: FileCheck2, text: "Clinical note signed" },
  update_availability: { icon: CalendarClock, text: "Counsellor availability updated" },
  create_classroom: { icon: Pencil, text: "Supervision classroom created" },
  add_classroom_member: { icon: UserPlus, text: "Counsellor added to a classroom" },
  remove_classroom_member: { icon: UserPlus, text: "Counsellor removed from a classroom" },
  generate_invoice: { icon: HandCoins, text: "Invoice raised for a session" },
  session_held_by_phone: { icon: Phone, text: "Session held by phone call" },
  assign_counsellor: { icon: CalendarClock, text: "Counsellor assigned to a room" },
  remove_room_assignment: { icon: CalendarX, text: "Room assignment removed" },
  create_room: { icon: Pencil, text: "New room added" },
  update_room: { icon: Pencil, text: "Room details updated" },
  session_phone_unmarked: { icon: Phone, text: "Phone-call record removed from a session" },
  archive_member_migrated: { icon: UserPlus, text: "Counsellor archived — caseload moved across" },
  archive_member_cancelled: { icon: CalendarX, text: "Counsellor archived — upcoming sessions cancelled" },
  archive_member: { icon: ShieldCheck, text: "Team member archived" },
  restore_member: { icon: ShieldCheck, text: "Team member restored" },
};

function humanize(r: ActivityRow): Meta {
  if (r.reason && REASONS[r.reason]) return REASONS[r.reason]!;
  if (r.action === "consent.change") return { icon: ShieldCheck, text: "A consent setting was changed" };
  // Fallback: prettify the reason code honestly rather than hiding the event.
  const words = (r.reason ?? r.action).replace(/[_.]/g, " ").trim();
  return { icon: Sparkles, text: words.charAt(0).toUpperCase() + words.slice(1) };
}

const WHEN = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function ActivityFeed({ activity }: { activity: ActivityRow[] }) {
  if (activity.length === 0) {
    return <p className="px-[17px] pb-[17px] pt-2 text-[12.5px] text-text-3">Activity will appear here as the practice works.</p>;
  }
  return (
    <ul className="divide-y divide-border px-[17px] pb-[9px]">
      {activity.map((r, i) => {
        const m = humanize(r);
        return (
          <li key={i} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-text-2">
              <m.icon className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-[550] leading-snug text-text">{m.text}</span>
              <span className="mt-0.5 block text-[11.5px] text-text-3">{r.actorName ?? "System"} · {WHEN.format(new Date(r.at))}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
