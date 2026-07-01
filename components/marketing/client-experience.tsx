import { Check, MessageCircle, Phone, ShieldCheck, Sprout, Video } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { ProductFrame } from "@/components/marketing/product-frame";
import { Card, CardHead } from "@/components/ui/card";

const POINTS = [
  { icon: Video, title: "Book in a couple of taps", body: "From your public page, on a phone, on metered data — service, time, consent, done." },
  { icon: MessageCircle, title: "Reminders on WhatsApp", body: "Booked, reminded, rescheduled — on the channel they already use every day." },
  { icon: Sprout, title: "A private space of their own", body: "Their sessions, documents, invoices, and the next steps their counsellor chooses to share." },
  { icon: ShieldCheck, title: "Crisis help, one tap away", body: "SADAG front and centre — a person in distress is never left to hunt for support." },
];

const STEPS = [
  { text: "Try the breathing exercise before bed", done: true },
  { text: "Note one thing that went well each day", done: true },
  { text: "Read the worksheet Nomsa shared", done: false },
];

/** The client / human side — what the people you serve actually experience. */
export function ClientExperience() {
  return (
    <section className="bg-surface-2/40 py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-accent">For the people you serve</span>
          <h2 className="mt-3 text-[clamp(1.6rem,3.2vw,2.3rem)] font-[680] leading-[1.14] tracking-[-0.03em] text-text">
            Your clients get a calm, private space — not a portal they dread.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-text-2">
            Booking that takes two taps, reminders where they already are, and a private home for their whole
            journey. The care is yours — Phila just makes it feel effortless for them.
          </p>

          <ul className="mt-6 space-y-4">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <p.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
                </span>
                <div>
                  <div className="text-[14px] font-[620] text-text">{p.title}</div>
                  <div className="text-[13.5px] leading-relaxed text-text-2">{p.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <ProductFrame url="philasa.com/me" className="mx-auto max-w-[440px]">
            <div className="space-y-3 p-4 sm:p-5">
              <div className="rounded-card border border-accent/30 bg-accent-soft/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold uppercase tracking-wide text-accent">Your next session</div>
                    <div className="mt-1 text-[16px] font-[680] tracking-[-0.01em] text-text">Wed 3 Jul · 10:00</div>
                    <div className="text-[12px] text-text-2">with Nomsa · online · in 2 days</div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-ink">
                    <Video className="size-3.5" strokeWidth={2} aria-hidden /> Join
                  </span>
                </div>
              </div>

              <Card>
                <CardHead title="Your steps" action={<span className="text-[11px] text-text-3">2 of 3 done</span>} />
                <div className="space-y-1.5 px-3.5 pb-3.5">
                  {STEPS.map((s) => (
                    <div key={s.text} className="flex items-center gap-2.5">
                      <span className={s.done ? "inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-white" : "size-4 shrink-0 rounded-full border border-border-strong"}>
                        {s.done && <Check className="size-2.5" strokeWidth={3} aria-hidden />}
                      </span>
                      <span className={s.done ? "text-[12.5px] text-text-3 line-through" : "text-[12.5px] text-text"}>{s.text}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="rounded-card border border-border bg-surface p-3.5">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-text">
                  <Phone className="size-3.5 text-accent" strokeWidth={2} aria-hidden /> If you need to talk now
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-2">
                  SADAG · <span className="font-semibold text-text">0800 567 567</span> — free, any time. You never have to hunt for help.
                </p>
              </div>
            </div>
          </ProductFrame>
        </Reveal>
      </div>
    </section>
  );
}
