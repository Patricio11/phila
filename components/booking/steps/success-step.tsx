import Link from "next/link";
import { CalendarDays, CheckCircle2, MapPin, MessageCircle, User, Video } from "lucide-react";
import type { BookingConfirmation } from "@/app/o/[slug]/book/actions";
import { formatWhen } from "@/components/booking/steps/confirm-step";

/**
 * The booking success state. Honest about delivery: messaging is dormant until
 * the org configures it, so we say a confirmation *will* be sent, never a fake
 * "sent" (Cost/Honesty Rules). The session would now appear on the client's
 * thread (the `/me` portal lands in Phase 3).
 */
export function SuccessStep({
  confirmation,
  orgName,
  orgSlug,
  preferredContact,
}: {
  confirmation: BookingConfirmation;
  orgName: string;
  orgSlug: string;
  preferredContact: string;
}) {
  return (
    <div className="text-center">
      <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <CheckCircle2 className="size-8" strokeWidth={1.9} aria-hidden />
      </span>
      <h1 className="mt-5 text-[21px] font-[700] tracking-[-0.02em] text-text">You&apos;re booked</h1>
      <p className="mt-2 text-[13.5px] text-text-2">
        Your session with {orgName} is confirmed. Reference{" "}
        <span className="font-semibold tabular-nums text-text">{confirmation.reference}</span>.
      </p>

      <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-control border border-border bg-surface-2/60 p-4 text-left">
        <Line icon={<CalendarDays className="size-4" />} text={formatWhen(confirmation.startsAt)} />
        <Line icon={<User className="size-4" />} text={`${confirmation.serviceName} · ${confirmation.counsellorName}`} />
        {confirmation.modality === "online" ? (
          <Line icon={<Video className="size-4" />} text={confirmation.joinUrl ? "Online · your secure join link is ready" : "Online · a secure video link will be sent before your session"} />
        ) : (
          <Line icon={<MapPin className="size-4" />} text={confirmation.roomName ? `In person · ${confirmation.roomName}` : "In person · your room is confirmed before the session"} />
        )}
        <Line
          icon={<MessageCircle className="size-4" />}
          text={`A confirmation will be sent by ${preferredContact.toLowerCase()} once it's ready.`}
        />
      </div>

      <div className="mx-auto mt-5 max-w-sm rounded-control border border-accent/25 bg-accent-soft/30 p-4 text-left">
        <div className="text-[13.5px] font-[640] text-text">Your private space is ready</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">
          We&apos;ve started a secure account for you. Set a password to see this session, reminders, and anything {orgName} shares.
        </p>
        <Link
          href="/activate"
          className="mt-3 inline-flex h-10 items-center rounded-control px-4 text-[13.5px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95"
          style={{ backgroundColor: "var(--brand)" }}
        >
          Set up your account
        </Link>
      </div>

      <div className="mt-6">
        <Link href={`/o/${orgSlug}`} className="text-[13px] font-medium text-text-2 hover:text-text hover:underline">
          Back to {orgName}
        </Link>
      </div>
    </div>
  );
}

function Line({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] text-text-2">
      <span className="mt-0.5 text-accent" aria-hidden>
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}
