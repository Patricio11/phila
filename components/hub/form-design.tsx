"use client";

import { useEffect, useState, useTransition } from "react";
import { ImageIcon, Loader2, Plus, Upload, X } from "lucide-react";
import type { FormTheme } from "@/lib/domain/types";
import { FORM_IMAGE_FITS } from "@/lib/domain/enums";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { HeroPanel } from "@/components/forms/form-theme";
import { requestFormImageUpload, signFormImage } from "@/app/hub/forms/actions";
import { cn } from "@/lib/utils";

/** The Design tab  presentation of the form's public/share page. */
export function FormDesign({ theme, orgName, onChange }: { theme: FormTheme; orgName: string; onChange: (t: FormTheme) => void }) {
  const { toast } = useToast();
  const [uploading, startUpload] = useTransition();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const bg = theme.background;
  const patch = (p: Partial<FormTheme>) => onChange({ ...theme, ...p });
  const patchHero = (p: Partial<FormTheme["hero"]>) => onChange({ ...theme, hero: { ...theme.hero, ...p } });
  const patchBg = (p: Partial<FormTheme["background"]>) => onChange({ ...theme, background: { ...theme.background, ...p } });

  // Load a preview URL for an already-saved background image.
  useEffect(() => {
    let alive = true;
    if (bg.type === "image" && bg.imageKey && !imageUrl) {
      signFormImage(bg.imageKey).then((r) => { if (alive && r.ok) setImageUrl(r.url); });
    }
    return () => { alive = false; };
  }, [bg.type, bg.imageKey, imageUrl]);

  const onFile = (file: File) =>
    startUpload(async () => {
      const res = await requestFormImageUpload({ name: file.name, contentType: file.type, bytes: file.size });
      if (!res.ok) return toast({ tone: "error", title: res.error });
      try {
        await fetch(res.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      } catch {
        return toast({ tone: "error", title: "Upload failed. Please try again." });
      }
      patchBg({ imageKey: res.key });
      const signed = await signFormImage(res.key);
      setImageUrl(signed.ok ? signed.url : null);
      toast({ tone: "success", title: "Background uploaded", description: "It counts toward your practice's storage." });
    });

  return (
    <div className="space-y-5">
      {/* Layout */}
      <Card className="space-y-3 p-5">
        <Label>Layout</Label>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <LayoutCard active={theme.layout === "form"} onClick={() => patch({ layout: "form" })} title="Just the form" body="A calm, single card. Best for private links you send to a client." />
          <LayoutCard active={theme.layout === "split"} onClick={() => patch({ layout: "split" })} title="Form + side panel" body="A branded panel beside the form (it stacks on top on mobile). Great for a share link." />
        </div>
      </Card>

      {theme.layout === "split" && (
        <>
          <Card className="space-y-4 p-5">
            <div className="text-[13px] font-[640] text-text">Side panel wording</div>
            <div className="space-y-1.5">
              <Label htmlFor="hero-heading">Heading</Label>
              <Input id="hero-heading" value={theme.hero.heading ?? ""} onChange={(e) => patchHero({ heading: e.target.value })} placeholder="e.g. Find your next place" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hero-sub">Subheading</Label>
              <Input id="hero-sub" value={theme.hero.subheading ?? ""} onChange={(e) => patchHero({ subheading: e.target.value })} placeholder="A sentence about why you're asking." />
            </div>
            <BulletsEditor bullets={theme.hero.bullets ?? []} onChange={(bullets) => patchHero({ bullets })} />
            <div className="space-y-1.5">
              <Label htmlFor="hero-foot">Footnote</Label>
              <Input id="hero-foot" value={theme.hero.footNote ?? ""} onChange={(e) => patchHero({ footNote: e.target.value })} placeholder="e.g. We usually reply within the hour." className="h-9 text-[13px]" />
            </div>
          </Card>

          {/* Background */}
          <Card className="space-y-4 p-5">
            <div className="text-[13px] font-[640] text-text">Background</div>
            <div className="flex flex-wrap gap-2">
              <Seg on={bg.type === "gradient"} onClick={() => patchBg({ type: "gradient" })}>Gradient</Seg>
              <Seg on={bg.type === "solid"} onClick={() => patchBg({ type: "solid" })}>Solid colour</Seg>
              <Seg on={bg.type === "image"} onClick={() => patchBg({ type: "image" })}>Image</Seg>
            </div>

            {bg.type === "gradient" && (
              <div className="flex flex-wrap items-end gap-4">
                <ColorField label="From" value={bg.gradientFrom ?? "#0f5132"} onChange={(v) => patchBg({ gradientFrom: v })} />
                <ColorField label="To" value={bg.gradientTo ?? "#1c7d58"} onChange={(v) => patchBg({ gradientTo: v })} />
                <div className="space-y-1">
                  <Label>Angle · {bg.gradientAngle ?? 150}°</Label>
                  <input type="range" min={0} max={360} value={bg.gradientAngle ?? 150} onChange={(e) => patchBg({ gradientAngle: Number(e.target.value) })} className="w-40 accent-accent" />
                </div>
              </div>
            )}

            {bg.type === "solid" && <ColorField label="Colour" value={bg.color ?? "#1c7d58"} onChange={(v) => patchBg({ color: v })} />}

            {bg.type === "image" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-[12.5px] font-medium text-text-2 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent">
                    {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" strokeWidth={2} aria-hidden />}
                    {bg.imageKey ? "Replace image" : "Upload image"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
                  </label>
                  {bg.imageKey && <Button variant="ghost" size="sm" onClick={() => { patchBg({ imageKey: undefined }); setImageUrl(null); }}><X className="size-3.5" strokeWidth={2} aria-hidden /> Remove</Button>}
                </div>
                <p className="text-[11px] text-text-3">Uploaded images count toward your practice&apos;s storage. If Phila Storage isn&apos;t on yet, use a colour or gradient.</p>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <Label>Fit</Label>
                    <div className="flex gap-2">{FORM_IMAGE_FITS.map((fit) => <Seg key={fit} on={(bg.imageFit ?? "cover") === fit} onClick={() => patchBg({ imageFit: fit })}>{fit === "cover" ? "Cover" : "Contain"}</Seg>)}</div>
                  </div>
                  <ColorField label="Overlay" value={bg.overlayColor ?? "#0b1f17"} onChange={(v) => patchBg({ overlayColor: v })} />
                  <div className="space-y-1">
                    <Label>Overlay · {bg.overlayOpacity ?? 0}%</Label>
                    <input type="range" min={0} max={100} value={bg.overlayOpacity ?? 0} onChange={(e) => patchBg({ overlayOpacity: Number(e.target.value) })} className="w-40 accent-accent" />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Live preview */}
          <div className="space-y-2">
            <div className="text-[12.5px] font-medium text-text-3">Live preview</div>
            <div className="overflow-hidden rounded-card border border-border shadow-sm">
              <div className="grid sm:grid-cols-2">
                <HeroPanel theme={theme} orgName={orgName} imageUrl={imageUrl} />
                <div className="flex items-center justify-center bg-surface p-6">
                  <div className="w-full max-w-[220px] space-y-2.5">
                    <div className="h-3 w-24 rounded bg-surface-2" />
                    <div className="h-9 rounded-control border border-border bg-surface-2/50" />
                    <div className="h-9 rounded-control border border-border bg-surface-2/50" />
                    <div className="h-9 rounded-control bg-accent/90" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LayoutCard({ active, onClick, title, body }: { active: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-card border p-3.5 text-left transition-colors", active ? "border-accent bg-accent-soft/40" : "border-border bg-surface hover:bg-surface-hover")}>
      <div className="flex items-center gap-2 text-[13.5px] font-[620] text-text"><ImageIcon className="size-4 text-text-3" strokeWidth={2} aria-hidden /> {title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-text-3">{body}</p>
    </button>
  );
}

function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-9 items-center rounded-control border px-3 text-[12.5px] font-medium transition-colors", on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:bg-surface-hover")}>
      {children}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-9 cursor-pointer rounded-control border border-border bg-surface p-0.5" aria-label={label} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-24 text-[12.5px]" />
      </div>
    </div>
  );
}

function BulletsEditor({ bullets, onChange }: { bullets: string[]; onChange: (next: string[]) => void }) {
  const list = bullets.length ? bullets : [""];
  return (
    <div className="space-y-1.5">
      <Label>Bullet points</Label>
      {list.map((b, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input value={b} onChange={(e) => onChange(list.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={`Point ${i + 1}`} className="h-9 text-[13px]" />
          <button type="button" onClick={() => onChange(list.filter((_, idx) => idx !== i))} disabled={list.length === 1} className="text-text-3 hover:text-danger disabled:opacity-30" aria-label="Remove point"><X className="size-4" /></button>
        </div>
      ))}
      {list.length < 6 && <Button variant="mini" onClick={() => onChange([...bullets, ""])}><Plus className="size-3.5" strokeWidth={2} aria-hidden /> Add point</Button>}
    </div>
  );
}
