import { CalendarCheck, ClipboardList, DoorOpen, FolderClosed, MessageCircle, MessagesSquare, ReceiptText, Sparkles, Video } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const CAPABILITIES = [
  // Row 1 - how clients come in and stay in touch.
  { icon: CalendarCheck, title: "Booking & intake", body: "A public page clients book from - service, time, consent, done. A waitlist holds the ones you can't seat yet." },
  { icon: ClipboardList, title: "Forms that send themselves", body: "Build once, pick the moment - on booking, after every session - and who fills it in: the client, the counsellor, or both. Answers land on the client's file." },
  { icon: MessageCircle, title: "WhatsApp, SMS & push", body: "Booked, reminded, nudged - on the channel your clients actually live on, with a gentle push for your team when they're away." },
  // Row 2 - the clinical work and the team around it.
  { icon: Sparkles, title: "AI scribe", body: "A note draft you edit and sign - and its structured fields feed your reporting." },
  { icon: FolderClosed, title: "Documents that file themselves", body: "Each client's folder lives under their counsellor; session notes arrive there as your letterhead PDF; reassign a client and everything moves with them." },
  { icon: MessagesSquare, title: "Messaging - team & clients", body: "Staff chat with groups, @mentions and typing - plus a private conversation each client can read and reply to." },
  // Row 3 - running the practice.
  { icon: ReceiptText, title: "Invoicing & PayShap", body: "A4 invoices with your own notes, pay-by-link, VAT the SA way - clients pay the practice directly." },
  { icon: Video, title: "Video & phone sessions", body: "Online sessions in-app and in-region - or a bridged phone call from a masked practice number, minutes metered honestly." },
  { icon: DoorOpen, title: "Rooms & utilisation", body: "Every room, who's in it, and how full it is - across sites, with no double-booking." },
];

/** The breadth story: Phila is one operating system, not a patchwork of tools. */
export function OnePlace() {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="The whole practice"
        title="One calm place - not seven tools that don't talk"
        lead="Today it's a scheduler in one tab, a Google Form for intake, a WhatsApp group, a Dropbox folder, a spreadsheet, and a separate invoice tool - none of them aware of each other. Phila is the one place where they are."
      />

      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((c, i) => (
          <Reveal key={c.title} delay={(i % 3) * 70}>
            <div className="h-full rounded-card border border-border bg-surface p-5 shadow-sm transition-shadow duration-200 hover:shadow-[var(--shadow-card)]">
              <span className="inline-flex size-9 items-center justify-center rounded-control bg-accent-soft text-accent">
                <c.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </span>
              <h3 className="mt-3.5 text-[14.5px] font-[640] tracking-[-0.01em] text-text">{c.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="mt-8 rounded-card border border-accent/25 bg-accent-soft/40 px-5 py-4 text-center sm:px-8 sm:py-5">
          <p className="mx-auto max-w-2xl text-[14.5px] leading-relaxed text-text">
            And it&apos;s <span className="font-[620] text-accent">one system</span>  a booking mints a room, a reminder, and an invoice; a signed note feeds the funder report. Nothing re-typed, nothing out of sync.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
