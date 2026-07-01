import Link from "next/link";
import { ArrowRight, CalendarCheck, Check, HeartPulse, MessagesSquare, NotebookPen, PieChart, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/* 1  Hero (copy-first funnel hero) ------------------------------------- */
export function MarketingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="drift absolute left-1/2 top-[-14%] h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] opacity-80 blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,var(--bg))]" />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="rise-stagger inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-[12px] font-medium text-text-2 shadow-sm">
          <ShieldCheck className="size-3.5 text-accent" strokeWidth={2} aria-hidden /> For South African counselling organisations
        </span>
        <h1 className="rise mt-5 text-[clamp(2.1rem,5.4vw,3.4rem)] font-[720] leading-[1.06] tracking-[-0.035em] text-text">
          Run your whole practice
          <br />
          <span className="text-accent">from one calm place.</span>
        </h1>
        <p className="rise mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-text-2" style={{ animationDelay: "0.06s" }}>
          Phila brings booking, the daily clinical loop, your team, documents, invoicing, and funder reporting
          into one place  built POPIA-first, with client data kept in South Africa.
        </p>
        <div className="rise mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.12s" }}>
          <Button asChild size="lg">
            <Link href="/signup">Get started <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden /></Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a href="mailto:hello@philasa.com?subject=Phila%20walkthrough">Book a walkthrough</a>
          </Button>
        </div>
        <p className="mt-4 text-[12.5px] text-text-3">No card needed. Every integration  payments, WhatsApp, video  stays dormant until you connect your own accounts.</p>
      </div>
    </section>
  );
}

/* 2  The problem -------------------------------------------------------- */
const PROBLEMS = [
  "Booking is a back-and-forth on WhatsApp, and no-shows you can't see coming.",
  "Notes in one tool, files in a shared drive, the team in a group chat, invoices in a spreadsheet  none of it talks.",
  "Friday afternoon means rebuilding the quarter from memory for every funder.",
  "Consent and demographics are a POPIA worry you keep meaning to sort out.",
];
export function Problem() {
  return (
    <section className="bg-surface-2/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <SectionHeading eyebrow="The reality" title="Sound familiar?" align="center" />
        <ul className="mx-auto mt-10 max-w-xl space-y-3">
          {PROBLEMS.map((p, i) => (
            <Reveal key={p} delay={i * 70}>
              <li className="flex gap-3 rounded-card border border-border bg-surface px-4 py-3.5 text-[14px] leading-relaxed text-text-2 shadow-sm">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
                {p}
              </li>
            </Reveal>
          ))}
        </ul>
        <Reveal delay={120}>
          <p className="mt-8 text-center text-[15.5px] font-[560] leading-relaxed text-text">
            It&apos;s not a caring problem  it&apos;s an admin problem. That&apos;s the part Phila fixes.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* 3  Who it's for ------------------------------------------------------- */
const FIT = [
  "You run a multi-counsellor team  NGO, EAP, campus, or faith-based  that bills clients directly.",
  "You have funders to report to and demographics to track.",
  "Your notes, files, team, and invoicing live in five different places.",
  "You're a growing private practice that has outgrown a personal calendar.",
];
const NOT_FIT = [
  "Your practice runs entirely on medical-aid claims (that's a different tool's job  Phila makes no medical-aid claims).",
  "You're a solo therapist who only needs a personal diary, with no team, funders, or reporting.",
];
export function WhoFor() {
  return (
    <section id="who" className="mx-auto w-full max-w-[1000px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="Who it's for" title="Built for teams that hold a caseload  and a report" align="center" />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-card border border-accent/30 bg-accent-soft/25 p-6">
            <div className="text-[13px] font-[680] text-accent">✅ This is you</div>
            <ul className="mt-4 space-y-3">
              {FIT.map((t) => (
                <li key={t} className="flex gap-2.5 text-[13.5px] leading-relaxed text-text-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.4} aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="h-full rounded-card border border-border bg-surface p-6">
            <div className="text-[13px] font-[680] text-text-2">🤔 Probably not you (yet)</div>
            <ul className="mt-4 space-y-3">
              {NOT_FIT.map((t) => (
                <li key={t} className="flex gap-2.5 text-[13.5px] leading-relaxed text-text-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-text-3" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
      <Reveal delay={140}>
        <p className="mt-8 text-center text-[15px] font-[560] text-text">If you run a team that bills clients directly and answers to funders, you&apos;re in the right place.</p>
      </Reveal>
    </section>
  );
}

/* 4  What changes ------------------------------------------------------- */
const CHANGES = [
  { title: "You never lose the thread of a client's care.", body: "Every session opens with what happened last time and the open goals  you pick up exactly where you left off." },
  { title: "Your team is finally in one place.", body: "Private staff messaging, shared documents, rooms, and supervision  no more scattered group chats and drives." },
  { title: "Funder reports write themselves.", body: "Indicators roll up live from the clinical work  consent-gated, k-anonymised, one click to the funder's template." },
  { title: "Your clients get a calm experience.", body: "Two-tap booking, reminders on WhatsApp, a private space, and crisis support always one tap away." },
  { title: "POPIA is handled, not hoped for.", body: "Consent, audit, field-level encryption, and tenant isolation from the first commit  client data kept in South Africa." },
];
export function WhatChanges() {
  return (
    <section className="bg-surface-2/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <SectionHeading eyebrow="The difference" title="What changes with Phila" align="center" />
        <ul className="mt-10 space-y-3">
          {CHANGES.map((c, i) => (
            <Reveal key={c.title} delay={i * 60}>
              <li className="rounded-card border border-border bg-surface p-4 shadow-sm sm:p-5">
                <div className="flex items-baseline gap-2">
                  <Check className="translate-y-0.5 size-4 shrink-0 text-accent" strokeWidth={2.6} aria-hidden />
                  <span className="text-[15px] font-[640] text-text">{c.title}</span>
                </div>
                <p className="mt-1.5 pl-6 text-[13.5px] leading-relaxed text-text-2">{c.body}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* 5  How it works ------------------------------------------------------- */
const STEPS = [
  { icon: CalendarCheck, t: "Get found & booked", b: "Your public page ranks and takes bookings  service, time, intake, and consent, all before the first session." },
  { icon: NotebookPen, t: "Hold the session", b: "Live notes alongside the room  in person or online, the same calm surface, always autosaving." },
  { icon: Sparkles, t: "Sign the note", b: "An AI draft you edit and sign  you're the author of record, and the structured fields are captured for reporting." },
  { icon: MessagesSquare, t: "Share & follow up", b: "Send the care plan and next steps to the client; reminders go out on WhatsApp; the team stays in sync." },
  { icon: PieChart, t: "Report", b: "Indicators roll up live  k-anon, audited  and export to the funder's template in one click." },
];
export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-[1000px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="How it works" title="One loop. Every day." align="center" lead="The clinical work is the product. Everything else  reporting included  falls out of it." />
      <ol className="mt-12 space-y-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.t} delay={i * 60}>
            <li className="flex items-start gap-4 rounded-card border border-border bg-surface p-4 shadow-sm sm:p-5">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                <s.icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold tabular-nums text-text-3">0{i + 1}</span>
                  <h3 className="text-[15.5px] font-[640] tracking-[-0.01em] text-text">{s.t}</h3>
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">{s.b}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* 6  Proof -------------------------------------------------------------- */
const PROMISES = [
  "Built in South Africa, for POPIA  not a global tool with a privacy bolt-on.",
  "Client data rests in South Africa; AI is de-identified before any cross-border call, on a zero-retention provider, and audio is never stored.",
  "Every integration  payments, WhatsApp, video, storage  is dormant until you connect your own account. Off is a real off.",
  "No medical-aid claims, ever. No diagnosis. AI output is always a draft a human signs.",
];
export function Proof() {
  return (
    <section className="bg-surface-2/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl px-4 text-center sm:px-6">
        <SectionHeading eyebrow="Proof" title="We'd rather show you than sell you" align="center" lead="Phila is new  we won't pretend otherwise. So instead of a pitch, we'll walk you through the real thing: a booking, a session, a signed note, and the funder report it rolls into  set up with your own services in mind." />
        <Reveal delay={80}>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg"><a href="mailto:hello@philasa.com?subject=Phila%20walkthrough">Book a walkthrough <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden /></a></Button>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-8 max-w-xl text-[13.5px] italic leading-relaxed text-text-3">
            We won&apos;t invent five-star quotes. As our first practices go live, their words will go here  with their names on them.
          </p>
        </Reveal>
        <div className="mx-auto mt-8 max-w-xl space-y-2.5 text-left">
          {PROMISES.map((p, i) => (
            <Reveal key={p} delay={140 + i * 50}>
              <div className="flex gap-2.5 text-[13.5px] leading-relaxed text-text-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden /> {p}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 7  Why Phila ---------------------------------------------------------- */
const WHY = [
  { icon: ShieldCheck, t: "POPIA-native", b: "Consent, audit, encryption, and tenant isolation are part of every read  not an afterthought." },
  { icon: HeartPulse, t: "The reporting no one else has", b: "A scoped, k-anon, read-only funder portal  live proof against targets, never an identifiable client." },
  { icon: MessagesSquare, t: "One system, not seven tools", b: "Booking, sessions, team, documents, invoicing, and reporting  all aware of each other." },
  { icon: Sparkles, t: "Bring your own, no lock-in", b: "Connect your own payment gateway, WhatsApp number, and video  month to month, take your data whenever." },
];
export function WhyPhila() {
  return (
    <section className="mx-auto w-full max-w-[1000px] px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="Why Phila" title="Why Phila, and not a patchwork" align="center" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {WHY.map((w, i) => (
          <Reveal key={w.t} delay={(i % 2) * 80}>
            <div className="flex h-full gap-4 rounded-card border border-border bg-surface p-5 shadow-sm">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                <w.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </span>
              <div>
                <div className="text-[14.5px] font-[640] text-text">{w.t}</div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">{w.b}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* Pricing teaser  shown when the live pricing switch is off ------------- */
export function PricingTeaser({ className }: { className?: string }) {
  return (
    <section id="pricing" className={cn("mx-auto w-full max-w-2xl scroll-mt-20 px-4 py-16 text-center sm:px-6 sm:py-24", className)}>
      <SectionHeading eyebrow="Pricing" title="Priced for total cost, not per seat" align="center" lead="Pricing leads with the whole cost of running your practice  with POPIA-in-SA as the wedge. We'll tailor a plan to your team and your funders." />
      <Reveal delay={80}>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg"><a href="mailto:hello@philasa.com?subject=Phila%20pricing">Talk to us about pricing <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden /></a></Button>
        </div>
      </Reveal>
    </section>
  );
}
