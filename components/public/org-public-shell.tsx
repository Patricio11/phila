import Link from "next/link";
import { ArrowRight, Clock, MapPin, Monitor, Phone } from "lucide-react";
import type { OrgPublicPage } from "@/lib/data-provider";
import { contrastSafeAccent } from "@/lib/contrast";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CredentialChip } from "@/components/ui/credential-chip";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Reveal } from "@/components/marketing/reveal";
import { initials } from "@/lib/utils";

/**
 * OrgPublicShell — an org's editable, SEO-built micro-site (DESIGN.md §9). The
 * org's `--brand-accent` recolours only this page's primary actions + brand tile
 * (auto-darkened to stay AA via lib/contrast); everything else stays Phila's
 * system. No PII — services, team (with honest credentials), and location only.
 */
export function OrgPublicShell({ page }: { page: OrgPublicPage }) {
  const { org } = page;
  const brand = contrastSafeAccent(org.brandAccent);
  const brandVars = { "--brand": brand } as React.CSSProperties;
  const bookHref = `/o/${org.slug}/book`;

  return (
    <div style={brandVars} className="min-h-dvh bg-bg">
      {/* Slim public header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1080px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandTile name={org.name} />
            <span className="text-[15px] font-[650] tracking-[-0.01em] text-text">{org.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href={bookHref}
              className="inline-flex h-10 items-center rounded-control px-4 text-[13.5px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Book a session
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-[1080px] px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
        <Reveal>
          <BrandTile name={org.name} size={56} className="text-xl" />
          <h1 className="mt-5 max-w-3xl text-[clamp(2rem,5vw,3rem)] font-[700] leading-[1.08] tracking-[-0.035em] text-text">
            {org.name}
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-text-2">{page.intro}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Tag tone="neutral">
              <MapPin className="size-3.5" strokeWidth={2} aria-hidden /> {org.province}
            </Tag>
            {page.offersOnline && (
              <Tag tone="online">
                <Monitor className="size-3.5" strokeWidth={2} aria-hidden /> Online sessions
              </Tag>
            )}
          </div>

          <div className="mt-7">
            <Link
              href={bookHref}
              className="inline-flex h-12 items-center gap-2 rounded-control px-6 text-[15px] font-medium text-white shadow-sm transition-[filter] hover:brightness-95"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Book a session
              <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* About */}
      <Section title="About">
        <p className="max-w-3xl text-[15px] leading-relaxed text-text-2">{page.about}</p>
      </Section>

      {/* Services */}
      <Section title="Services" id="services">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.services.map((s, i) => (
            <Reveal key={s.id} delay={i * 70}>
              <div className="flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-sm">
                <h3 className="text-[15px] font-[640] text-text">{s.name}</h3>
                <div className="mt-2 flex items-center gap-3 text-[12.5px] text-text-3">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" strokeWidth={2} aria-hidden /> {s.durationMin} min
                  </span>
                  <span className="font-semibold text-text">{formatPrice(s.priceCents)}</span>
                </div>
                <Link
                  href={`${bookHref}?service=${s.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold"
                  style={{ color: "var(--brand)" }}
                >
                  Book this <ArrowRight className="size-3.5" strokeWidth={2.2} aria-hidden />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Team */}
      <Section title="Our team">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.team.map((c, i) => (
            <Reveal key={c.id} delay={i * 70}>
              <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-sm">
                <Avatar name={c.name} size="lg" verified={c.credential.status === "verified"} />
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-[620] text-text">{c.name}</div>
                  <div className="mt-1.5">
                    <CredentialChip body={c.credential.body} status={c.credential.status} />
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Location */}
      <Section title="Where to find us">
        <div className="grid gap-3 sm:grid-cols-2">
          {page.sites.map((s) => (
            <div key={s.id} className="flex items-start gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
              <span className="inline-flex size-9 items-center justify-center rounded-control bg-accent-soft text-accent">
                <MapPin className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </span>
              <div>
                <div className="text-[14px] font-[620] text-text">{s.name}</div>
                <div className="text-[12.5px] text-text-3">{s.province}</div>
              </div>
            </div>
          ))}
          {page.offersOnline && (
            <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
              <span className="inline-flex size-9 items-center justify-center rounded-control bg-info-soft text-info">
                <Monitor className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </span>
              <div>
                <div className="text-[14px] font-[620] text-text">Online sessions</div>
                <div className="text-[12.5px] text-text-3">Secure video, anywhere in South Africa</div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Footer */}
      <footer className="mt-8 border-t border-border bg-surface-2/50">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-2 px-4 py-8 text-[12px] text-text-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5" aria-hidden /> Your information is kept confidential and
            protected under POPIA.
          </span>
          <span>
            Powered by{" "}
            <Link href="/" className="font-semibold text-text-2 hover:text-text">
              Phila
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-[1080px] scroll-mt-20 px-4 py-8 sm:px-6">
      <Reveal>
        <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.07em] text-text-3">
          {title}
        </h2>
        {children}
      </Reveal>
    </section>
  );
}

function BrandTile({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] font-bold text-white shadow-sm ${className ?? "text-[13px]"}`}
      style={{ width: size, height: size, backgroundColor: "var(--brand)" }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "Enquire";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
