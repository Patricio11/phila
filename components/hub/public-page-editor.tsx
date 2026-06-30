"use client";

import { useState, useTransition } from "react";
import { BarChart3, ExternalLink, Eye, EyeOff, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import type { PublicPageContent } from "@/lib/data-provider";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { savePublicPage } from "@/app/hub/settings/public-page-actions";
import { cn } from "@/lib/utils";

type Stats = { views: number; bookClicks: number; booked: number; conversion: number };

/**
 * Public-page section editor (Phase 17). The org manages each section's content +
 * visibility; one save persists to org_public_pages and revalidates the live page.
 */
export function PublicPageEditor({ slug, initial, stats }: { slug: string; initial: PublicPageContent; stats: Stats }) {
  const { toast } = useToast();
  const [c, setC] = useState<PublicPageContent>(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof PublicPageContent>(k: K, v: PublicPageContent[K]) => setC((p) => ({ ...p, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await savePublicPage({ slug, ...c });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      toast({ tone: "success", title: "Public page updated", description: "Your changes are live." });
    });

  return (
    <div className="space-y-4">
      {/* Stats + live link */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border bg-surface-2/40 p-3">
        <BarChart3 className="size-4 text-text-3" strokeWidth={2} aria-hidden />
        <Stat label="Views" value={stats.views} />
        <Stat label="Booking clicks" value={stats.bookClicks} />
        <Stat label="Booked" value={stats.booked} />
        <Stat label="Conversion" value={`${stats.conversion}%`} />
        <span className="ml-auto text-[11px] text-text-3">last 30 days · no visitor data</span>
        <Button asChild variant="ghost" size="sm">
          <a href={`/o/${slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" strokeWidth={2} aria-hidden /> View live</a>
        </Button>
      </div>

      <SectionCard title="Hero" alwaysOn>
        <Field label="Headline"><Input value={c.heroHeadline ?? ""} onChange={(e) => set("heroHeadline", e.target.value || null)} placeholder="Counselling that meets you where you are" /></Field>
        <Field label="Intro line"><Textarea value={c.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} className="min-h-[72px]" placeholder="A warm one-sentence welcome…" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Button text"><Input value={c.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Book a session" /></Field>
          <div className="flex items-end pb-1"><InlineToggle label="Show “Online sessions” badge" on={c.showOnlineBadge} onToggle={(v) => set("showOnlineBadge", v)} /></div>
        </div>
      </SectionCard>

      <SectionCard title="About" on={c.showAbout} onToggle={(v) => set("showAbout", v)}>
        <Field label="Heading"><Input value={c.aboutTitle} onChange={(e) => set("aboutTitle", e.target.value)} /></Field>
        <Field label="Your story"><Textarea value={c.aboutBody} onChange={(e) => set("aboutBody", e.target.value)} className="min-h-[120px]" placeholder="Who you are, who you help, and how you work…" /></Field>
      </SectionCard>

      <SectionCard title="How we work" on={c.showApproach} onToggle={(v) => set("showApproach", v)}>
        <Field label="Heading"><Input value={c.approachTitle} onChange={(e) => set("approachTitle", e.target.value)} /></Field>
        <ListEditor items={c.approachItems} onChange={(items) => set("approachItems", items)} blank={{ title: "", body: "" }} max={6} addLabel="Add a point"
          render={(it, _i, upd) => (<>
            <Input value={it.title} onChange={(e) => upd({ ...it, title: e.target.value })} placeholder="Confidential & POPIA-protected" />
            <Textarea value={it.body} onChange={(e) => upd({ ...it, body: e.target.value })} className="min-h-[56px]" placeholder="A sentence or two…" />
          </>)} />
      </SectionCard>

      <SectionCard title="Services" on={c.showServices} onToggle={(v) => set("showServices", v)}>
        <p className="text-[12.5px] text-text-3">Pulled live from your <b className="text-text-2">Services</b> (name, duration, price). The toggle shows or hides the whole section.</p>
      </SectionCard>
      <SectionCard title="Team" on={c.showTeam} onToggle={(v) => set("showTeam", v)}>
        <p className="text-[12.5px] text-text-3">Pulled live from your <b className="text-text-2">Team</b>, with each counsellor&apos;s verified credential.</p>
      </SectionCard>

      <SectionCard title="FAQ" on={c.showFaq} onToggle={(v) => set("showFaq", v)}>
        <ListEditor items={c.faqItems} onChange={(items) => set("faqItems", items)} blank={{ question: "", answer: "" }} max={12} addLabel="Add a question"
          render={(it, _i, upd) => (<>
            <Input value={it.question} onChange={(e) => upd({ ...it, question: e.target.value })} placeholder="How do I book a first session?" />
            <Textarea value={it.answer} onChange={(e) => upd({ ...it, answer: e.target.value })} className="min-h-[56px]" placeholder="Your answer…" />
          </>)} />
      </SectionCard>

      <SectionCard title="Contact" on={c.showContact} onToggle={(v) => set("showContact", v)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><Input value={c.contactPhone ?? ""} onChange={(e) => set("contactPhone", e.target.value || null)} placeholder="+27 11 555 0100" /></Field>
          <Field label="Email"><Input value={c.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value || null)} placeholder="reception@practice.co.za" /></Field>
        </div>
        <p className="text-[12.5px] text-text-3">Your locations come from <b className="text-text-2">Rooms / sites</b>.</p>
      </SectionCard>

      <SectionCard title="Search engine (SEO)" alwaysOn>
        <Field label="Page title" hint={`${(c.seoTitle ?? "").length}/70`}><Input value={c.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value || null)} placeholder="Masizakhe Counselling  counselling in Soweto & Johannesburg" /></Field>
        <Field label="Meta description" hint={`${(c.seoDescription ?? "").length}/180`}><Textarea value={c.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value || null)} className="min-h-[56px]" placeholder="One or two sentences Google shows under your title…" /></Field>
        <p className="text-[12.5px] text-text-3">Leave blank to use sensible defaults from your name, province, and intro.</p>
      </SectionCard>

      <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-card border border-border bg-surface/90 p-3 shadow-card backdrop-blur">
        <span className="text-[12.5px] text-text-3">Edits go live the moment you save.</span>
        <Button onClick={save} loading={pending}><Save className="size-4" strokeWidth={2} aria-hidden /> Save public page</Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-baseline gap-1.5"><span className="text-[15px] font-[680] tabular-nums text-text">{value}</span><span className="text-[11.5px] text-text-3">{label}</span></div>;
}

function SectionCard({ title, children, on, onToggle, alwaysOn }: { title: string; children: React.ReactNode; on?: boolean; onToggle?: (v: boolean) => void; alwaysOn?: boolean }) {
  const hidden = !alwaysOn && on === false;
  return (
    <Card>
      <CardHead title={title} action={alwaysOn ? <span className="text-[11px] text-text-3">Always shown</span> : <InlineToggle label={hidden ? "Hidden" : "Shown"} on={Boolean(on)} onToggle={onToggle!} />} />
      <div className={cn("space-y-3 px-[17px] pb-[17px]", hidden && "opacity-55")}>{children}</div>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between"><Label>{label}</Label>{hint && <span className="text-[11px] tabular-nums text-text-3">{hint}</span>}</div>
      {children}
    </div>
  );
}

function InlineToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onToggle(!on)} className={cn("inline-flex items-center gap-1.5 rounded-control px-1.5 py-1 text-[12px] font-medium transition-colors", on ? "text-accent" : "text-text-3 hover:text-text-2")} aria-pressed={on}>
      {on ? <Eye className="size-3.5" strokeWidth={2} aria-hidden /> : <EyeOff className="size-3.5" strokeWidth={2} aria-hidden />}
      {label}
      <span className={cn("relative ml-0.5 inline-flex h-4 w-7 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-surface-2")} aria-hidden>
        <span className={cn("absolute size-3 rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-3.5" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

function ListEditor<T>({ items, onChange, blank, max, addLabel, render }: { items: T[]; onChange: (items: T[]) => void; blank: T; max: number; addLabel: string; render: (item: T, i: number, upd: (next: T) => void) => React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 rounded-control border border-border bg-surface-2/40 p-3">
          <GripVertical className="mt-2 size-4 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
          <div className="flex-1 space-y-2">{render(it, i, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}</div>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="mt-1.5 self-start text-text-3 transition-colors hover:text-danger" aria-label="Remove"><Trash2 className="size-4" strokeWidth={2} aria-hidden /></button>
        </div>
      ))}
      {items.length < max && <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...items, { ...blank }])}><Plus className="size-3.5" strokeWidth={2} aria-hidden /> {addLabel}</Button>}
    </div>
  );
}
