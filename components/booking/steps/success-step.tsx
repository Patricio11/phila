import Link from "next/link";
import { CalendarDays, CheckCircle2, MessageCircle, User } from "lucide-react";
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
        <Line
          icon={<MessageCircle className="size-4" />}
          text={`A confirmation will be sent by ${preferredContact.toLowerCase()} once it's ready.`}
        />
      </div>

      <div className="mt-7 flex flex-col items-center gap-2">
        <Link
          href={`/o/${orgSlug}`}
          className="inline-flex h-11 items-center rounded-control px-5 text-[14px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95"
          style={{ backgroundColor: "var(--brand)" }}
        >
          Back to {orgName}
        </Link>
        <p className="text-[12px] text-text-3">
          You&apos;ll be able to manage this in your Phila account.
        </p>
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
