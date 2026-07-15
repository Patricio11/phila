"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitContactMessage } from "@/app/o/[slug]/contact-actions";

/**
 * The public page's contact form (builder upgrade). Calm, minimal, branded with
 * the org's --brand accent. Deliberately asks only name + a way to reply + the
 * message, with a gentle "nothing sensitive" note — this is a front door, never
 * an intake. A hidden honeypot field quietly absorbs bots.
 */
export function ContactForm({ slug, practiceName }: { slug: string; practiceName: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await submitContactMessage({ slug, ...form });
      if (!res.ok) return setError(res.error);
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-10 text-center shadow-sm">
        <span className="grid size-12 place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)" }}>
          <CheckCircle2 className="size-6" style={{ color: "var(--brand)" }} strokeWidth={2} aria-hidden />
        </span>
        <div className="text-[16px] font-[660] text-text">Thank you — your message is on its way</div>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-text-2">{practiceName} will get back to you as soon as they can, usually within a working day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <PublicField label="Your name" required>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} autoComplete="name" className={inputCls} placeholder="Naledi Dlamini" />
        </PublicField>
        <PublicField label="Email">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={120} autoComplete="email" className={inputCls} placeholder="you@email.co.za" />
        </PublicField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PublicField label="Phone (optional)">
          <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} autoComplete="tel" className={inputCls} placeholder="082 123 4567" />
        </PublicField>
        <div className="hidden sm:block" aria-hidden />
      </div>
      <PublicField label="Your message" required>
        <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required minLength={10} maxLength={2000} rows={4} className={`${inputCls} min-h-[110px] resize-y py-2.5`} placeholder="How can we help?" />
      </PublicField>

      {/* Honeypot — invisible to people, irresistible to bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />

      {error && <p className="text-[12.5px] font-medium text-danger">{error}</p>}

      <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11.5px] leading-snug text-text-3">Please don&apos;t include anything sensitive here — save that for your session. If you need to talk right now, SADAG is free, any time: 0800 567 567.</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control px-5 text-[14px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95 disabled:opacity-60"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <Send className="size-4" strokeWidth={2} aria-hidden /> {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "h-11 w-full rounded-control border border-border bg-surface px-3 text-[14px] text-text placeholder:text-text-3/70 transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)]/25";

function PublicField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[12.5px] font-medium text-text-2">{label}{required && <span className="text-text-3"> *</span>}</span>
      {children}
    </label>
  );
}
