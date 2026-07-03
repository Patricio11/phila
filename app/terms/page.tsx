import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, HeartHandshake, Phone } from "lucide-react";
import { PhilaMark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Terms & Conditions · Phila",
  description:
    "The plain-language terms for booking and care on Phila  what you agree to, how your information is handled, and your rights under POPIA.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/terms" },
};

/**
 * Booking Terms & Conditions  the single acceptance that replaces the old page of
 * consent toggles. Written plainly (DESIGN §7: plain, warm, certain). Each section
 * is one of the consents the booking flow used to ask for, now explained here.
 */
export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[820px] items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <PhilaMark size={30} />
            <span className="text-[15px] font-[650] tracking-[-0.01em] text-text">Phila</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-2 transition-colors hover:text-text">
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> Back to Phila
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[820px] px-5 py-12 sm:px-6 sm:py-16">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-accent">The agreement</p>
        <h1 className="mt-2 text-[clamp(1.7rem,4vw,2.4rem)] font-[700] leading-[1.12] tracking-[-0.03em] text-text">
          Terms &amp; Conditions
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-text-2">
          These are the everyday terms for booking a session and being cared for through Phila. We&apos;ve kept
          them short and human. When you book, you accept these terms  which cover the consents your care
          needs. You can withdraw an optional consent, or ask us to delete your information, at any time.
        </p>

        <div className="mt-10 space-y-9">
          <Section title="1. Who&apos;s who">
            <p>
              <Strong>Your practice</Strong>  the counselling organisation you booked with  provides your care
              and is responsible for your clinical information. <Strong>Phila</Strong> is the secure software the
              practice uses to run its work: booking, reminders, notes, documents and reporting. Phila never
              diagnoses, never provides the counselling itself, and never sells your information.
            </p>
          </Section>

          <Section title="2. Booking &amp; appointments  required">
            <p>
              We use the details you give us to schedule your sessions, hold your slot, and manage any changes or
              cancellations. This is essential to provide the service, so it&apos;s a required part of booking.
              Please give as much notice as you can if you need to reschedule.
            </p>
          </Section>

          <Section title="3. Confidential clinical notes  required">
            <p>
              So your counsellor can support your care properly, they keep private clinical notes. These are
              <Strong> confidential</Strong>: only your counsellor and their clinical supervisor can read them,
              and every access is recorded in an audit trail. Practice administrators can see that a note exists
              and manage your appointments, but the note content stays with your counsellor.
            </p>
          </Section>

          <Section title="4. Reminders &amp; messages">
            <p>
              We&apos;ll send appointment reminders and updates on the channel you choose  WhatsApp, SMS or email.
              These help you keep your sessions; you can <Strong>opt out any time</Strong> and still keep your
              bookings.
            </p>
          </Section>

          <Section title="5. Your information &amp; privacy (POPIA)">
            <p>
              Your information is <Strong>special personal information</Strong> under South Africa&apos;s Protection
              of Personal Information Act. We hold it lawfully, keep it confidential, store it in South Africa, and
              record every access. We only use it to provide and improve your care and to run the practice  never
              to market to you without asking. You have the right to see your information, correct it, or ask for
              it to be deleted.
            </p>
          </Section>

          <Section title="6. Demographic information  optional">
            <p>
              Anonymous details like your age band and province may be used <Strong>only for reporting</Strong>
              {" "} to understand who the practice serves. These figures are aggregated and never identify you on
              any shared view. This is optional; you can decline or withdraw it without affecting your care.
            </p>
          </Section>

          <Section title="7. Anonymous funder reporting  optional">
            <p>
              Many practices are funded to help specific communities. With your agreement, your{" "}
              <Strong>de-identified</Strong> progress can count toward a programme&apos;s funded targets  as
              aggregate figures only, never a record of you. This is optional and can be withdrawn at any time.
            </p>
          </Section>

          <Section title="8. AI assistance  separate, explicit consent">
            <p>
              If your practice uses Phila&apos;s AI note assistant, it only ever drafts notes for your counsellor to
              review, edit and sign  and your information is de-identified first. Because this can involve
              processing outside South Africa, it is <Strong>never bundled into these terms</Strong>: it requires
              its own explicit consent, which you can give or refuse separately.
            </p>
          </Section>

          <Section title="9. Payments">
            <p>
              Where a session or deposit is payable, you pay the practice directly through a secure gateway. Phila
              orchestrates the request but does not hold your card details. Any deposit and refund terms are set by
              your practice and shown to you before you pay.
            </p>
          </Section>

          <Section title="10. Changes to these terms">
            <p>
              We may update these terms as the service grows. If a change is significant, we&apos;ll let you know.
              Continuing to use Phila after an update means you accept the revised terms.
            </p>
          </Section>
        </div>

        {/* Crisis line  a person in distress is never left to hunt for help. */}
        <div className="mt-12 flex items-start gap-3 rounded-card border border-accent/25 bg-accent-soft/40 p-4 sm:p-5">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Phone className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <p className="text-[13.5px] leading-relaxed text-text-2">
            <span className="font-[620] text-text">If you need to talk now</span>  SADAG is free, any time, on{" "}
            <span className="font-semibold text-text">0800 567 567</span>. You never have to hunt for help.
          </p>
        </div>

        <div className="mt-10 flex items-center gap-2 text-[12.5px] text-text-3">
          <HeartHandshake className="size-4 text-accent" strokeWidth={2} aria-hidden />
          Made for South Africa · Built consent-first · philasa.com
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-[660] tracking-[-0.01em] text-text">{title}</h2>
      <div className="mt-2 text-[14px] leading-relaxed text-text-2 [&_p]:text-[14px]">{children}</div>
    </section>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-[600] text-text">{children}</span>;
}
