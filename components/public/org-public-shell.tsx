import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, Monitor, Phone, ShieldCheck } from "lucide-react";
import type { OrgPublicPage, PublicPageContent } from "@/lib/data-provider";
import { contrastSafeAccent } from "@/lib/contrast";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CredentialChip } from "@/components/ui/credential-chip";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Reveal } from "@/components/marketing/reveal";
import { initials } from "@/lib/utils";

/**
 * OrgPublicShell (Phase 17)  an org's editable, SEO-built micro-site. Every section
 * is driven by `page.content` (org-managed, persisted) and can be shown/hidden. The
 * org's `--brand-accent` recolours only the primary actions + brand tile (auto-darkened
 * to stay AA). No PII  services, team (honest credentials), approach, FAQ, contact only.
 */
export function OrgPublicShell({ page, logoUrl = null }: { page: OrgPublicPage; logoUrl?: string | null }) {
  const { org } = page;
  const c: PublicPageContent | undefined = page.content;
  const brand = contrastSafeAccent(org.brandAccent);
  const brandVars = { "--brand": brand } as React.CSSProperties;
  const bookHref = `/o/${org.slug}/book`;
  const ctaText = c?.ctaText || "Book a session";
  const headline = c?.heroHeadline || org.name;
  const subtitle = c?.heroSubtitle || page.intro;

  return (
    <div style={brandVars} className="min-h-dvh bg-bg">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1080px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={`${org.name} logo`} className="size-9 rounded-lg object-contain" />
            ) : (
              <BrandTile name={org.name} />
            )}
            <span className="text-[15px] font-[650] tracking-[-0.01em] text-text">{org.name}</span>
          </div>
          <nav className="ml-auto hidden items-center gap-5 text-[13px] text-text-2 md:flex">
            {c?.showServices !== false && <a href="#services" className="transition-colors hover:text-text">Services</a>}
            {c?.showApproach && <a href="#approach" className="transition-colors hover:text-text">How we work</a>}
            {c?.showFaq && <a href="#faq" className="transition-colors hover:text-text">FAQ</a>}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-3">
            <ThemeToggle />
            <Link href={bookHref} className="inline-flex h-10 items-center rounded-control px-4 text-[13.5px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95" style={{ backgroundColor: "var(--brand)" }}>
              {ctaText}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 80% at 15% -10%, color-mix(in srgb, var(--brand) 16%, transparent), transparent 70%)" }} />
        <div className="relative mx-auto w-full max-w-[1080px] px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 rounded-pill border border-border bg-surface/70 px-3 py-1 text-[12px] text-text-2">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: "var(--brand)" }} aria-hidden />
              {org.name} · {org.province}
            </div>
            <h1 className="max-w-3xl text-[clamp(2.1rem,5.5vw,3.4rem)] font-[720] leading-[1.05] tracking-[-0.035em] text-text">{headline}</h1>
            <p className="mt-5 max-w-2xl text-[16.5px] leading-relaxed text-text-2">{subtitle}</p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Tag tone="neutral"><MapPin className="size-3.5" strokeWidth={2} aria-hidden /> {org.province}</Tag>
              {(c?.showOnlineBadge ?? page.offersOnline) && <Tag tone="online"><Monitor className="size-3.5" strokeWidth={2} aria-hidden /> Online sessions</Tag>}
              <Tag tone="accent"><ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden /> POPIA-protected</Tag>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={bookHref} className="inline-flex h-12 items-center gap-2 rounded-control px-6 text-[15px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95" style={{ backgroundColor: "var(--brand)" }}>
                {ctaText} <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
              </Link>
              {c?.showServices !== false && page.services.length > 0 && (
                <a href="#services" className="inline-flex h-12 items-center rounded-control border border-border bg-surface px-5 text-[14px] font-medium text-text transition-colors hover:bg-surface-hover">View services</a>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Approach */}
      {c?.showApproach && c.approachItems.length > 0 && (
        <Section title={c.approachTitle} id="approach">
          <div className="grid gap-3 sm:grid-cols-3">
            {c.approachItems.map((a, i) => (
              <Reveal key={a.title} delay={i * 70}>
                <div className="flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-sm">
                  <span className="mb-3 inline-flex size-9 items-center justify-center rounded-control text-[15px] font-bold text-white" style={{ backgroundColor: "var(--brand)" }}>{i + 1}</span>
                  <h3 className="text-[15px] font-[640] text-text">{a.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{a.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* About */}
      {(c?.showAbout ?? Boolean(page.about)) && page.about && (
        <Section title={c?.aboutTitle || "About"}>
          <p className="max-w-3xl text-[15.5px] leading-relaxed text-text-2">{page.about}</p>
        </Section>
      )}

      {/* Services */}
      {c?.showServices !== false && page.services.length > 0 && (
        <Section title="Services" id="services">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {page.services.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <div className="flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-card">
                  <h3 className="text-[15px] font-[640] text-text">{s.name}</h3>
                  <div className="mt-2 flex items-center gap-3 text-[12.5px] text-text-3">
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={2} aria-hidden /> {s.durationMin} min</span>
                    <span className="font-semibold text-text">{formatPrice(s.priceCents)}</span>
                  </div>
                  <Link href={`${bookHref}?service=${s.id}`} className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--brand)" }}>
                    Book this <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* Team */}
      {c?.showTeam !== false && page.team.length > 0 && (
        <Section title="Our team">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {page.team.map((m, i) => (
              <Reveal key={m.id} delay={i * 60}>
                <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-sm">
                  <Avatar name={m.name} size="lg" verified={m.credential.status === "verified"} />
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-[620] text-text">{m.name}</div>
                    <div className="mt-1.5"><CredentialChip body={m.credential.body} status={m.credential.status} /></div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* FAQ */}
      {c?.showFaq && c.faqItems.length > 0 && (
        <Section title="Frequently asked" id="faq">
          <div className="mx-auto max-w-2xl space-y-2.5">
            {c.faqItems.map((f) => (
              <details key={f.question} className="group rounded-card border border-border bg-surface px-4 py-3 shadow-sm [&[open]]:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-[620] text-text">
                  {f.question}
                  <ArrowRight className="size-4 shrink-0 text-text-3 transition-transform group-open:rotate-90" strokeWidth={2} aria-hidden />
                </summary>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">{f.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      {/* Contact + location */}
      {c?.showContact !== false && (
        <Section title="Visit or contact us">
          <div className="grid gap-3 sm:grid-cols-2">
            {page.sites.map((s) => (
              <div key={s.id} className="flex items-start gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
                <span className="inline-flex size-9 items-center justify-center rounded-control bg-accent-soft text-accent"><MapPin className="size-[18px]" strokeWidth={1.9} aria-hidden /></span>
                <div><div className="text-[14px] font-[620] text-text">{s.name}</div><div className="text-[12.5px] text-text-3">{s.province}</div></div>
              </div>
            ))}
            {(c?.showOnlineBadge ?? page.offersOnline) && (
              <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
                <span className="inline-flex size-9 items-center justify-center rounded-control bg-info-soft text-info"><Monitor className="size-[18px]" strokeWidth={1.9} aria-hidden /></span>
                <div><div className="text-[14px] font-[620] text-text">Online sessions</div><div className="text-[12.5px] text-text-3">Secure video, anywhere in South Africa</div></div>
              </div>
            )}
            {(c?.contactEmail || c?.contactPhone) && (
              <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 shadow-sm">
                {c?.contactPhone && <a href={`tel:${c.contactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-[13.5px] text-text-2 transition-colors hover:text-text"><Phone className="size-4 text-text-3" strokeWidth={2} aria-hidden /> {c.contactPhone}</a>}
                {c?.contactEmail && <a href={`mailto:${c.contactEmail}`} className="inline-flex items-center gap-2 text-[13.5px] text-text-2 transition-colors hover:text-text"><Mail className="size-4 text-text-3" strokeWidth={2} aria-hidden /> {c.contactEmail}</a>}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Final CTA band */}
      <section className="mx-auto w-full max-w-[1080px] px-4 py-10 sm:px-6">
        <Reveal>
          <div className="flex flex-col items-start gap-4 rounded-card border border-border p-7 sm:flex-row sm:items-center sm:justify-between" style={{ background: "color-mix(in srgb, var(--brand) 9%, var(--surface))" }}>
            <div>
              <h2 className="text-[20px] font-[680] tracking-[-0.02em] text-text">Ready when you are.</h2>
              <p className="mt-1 text-[14px] text-text-2">Booking takes a couple of minutes  confidential, no apps to install.</p>
            </div>
            <Link href={bookHref} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-control px-6 text-[15px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95" style={{ backgroundColor: "var(--brand)" }}>
              {ctaText} <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface-2/50">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-2 px-4 py-8 text-[12px] text-text-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" aria-hidden /> Your information is kept confidential and protected under POPIA.</span>
          <span>Powered by <Link href="/" className="font-semibold text-text-2 hover:text-text">Phila</Link></span>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-[1080px] scroll-mt-20 px-4 py-9 sm:px-6">
      <Reveal>
        <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.07em] text-text-3">{title}</h2>
        {children}
      </Reveal>
    </section>
  );
}

function BrandTile({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-[10px] font-bold text-white shadow-sm ${className ?? "text-[13px]"}`} style={{ width: size, height: size, backgroundColor: "var(--brand)" }} aria-hidden>
      {initials(name)}
    </span>
  );
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "Enquire";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
