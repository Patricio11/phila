"use client";

import { useState, useTransition } from "react";
import { Check, Info, Pipette } from "lucide-react";
import { saveOrgBranding } from "@/app/hub/settings/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { contrastSafeAccent, hexToRgb, contrastRatio } from "@/lib/contrast";
import { cn } from "@/lib/utils";

const HEX = /^#[0-9a-fA-F]{6}$/;
// A calm, professional starter palette (all reasonably legible on white).
const PRESETS = ["#1C7D58", "#0F5132", "#1D4ED8", "#6D28D9", "#0E7490", "#B45309", "#BE123C", "#334155"];
const WHITE = { r: 255, g: 255, b: 255 };

/**
 * Brand accent (W6.1) — the colour used across the hub, the client portal, and the
 * public micro-site. Previously only set at signup; this makes it editable. We show
 * a live preview and, when a colour is too light to read on white, note that Phila
 * darkens it for legibility (the same `contrastSafeAccent` the app applies at render).
 */
export function BrandingSettings({ initial }: { initial: string }) {
  const { toast } = useToast();
  const [hex, setHex] = useState(initial.toUpperCase());
  const [pending, start] = useTransition();

  const valid = HEX.test(hex);
  const safe = valid ? contrastSafeAccent(hex) : hex;
  const adjusted = valid && safe.toUpperCase() !== hex.toUpperCase();
  const ratio = valid ? contrastRatio(hexToRgb(hex), WHITE) : 0;
  const dirty = hex.toUpperCase() !== initial.toUpperCase();

  const save = () => start(async () => {
    const res = await saveOrgBranding({ brandAccent: hex.toUpperCase() });
    if (!res.ok) return toast({ tone: "error", title: "Couldn't save", description: res.error });
    toast({ tone: "success", title: "Brand colour updated", description: "It now shows across the hub, the client portal, and your public page." });
  });

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-text-2">Your accent colour  used for buttons, links, and highlights across the hub, the client portal, and your public page.</p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="brand-hex">Accent colour</Label>
          <div className="flex items-center gap-2">
            {/* Custom swatch — the (invisible) native input on top only summons the OS colour dialog. */}
            <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-border bg-surface transition-shadow hover:shadow-sm">
              <span className="size-6 rounded-[6px] shadow-inner ring-1 ring-black/5" style={{ backgroundColor: valid ? hex : "#1C7D58" }} aria-hidden />
              <Pipette className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-surface p-0.5 text-text-3 shadow-sm ring-1 ring-border" strokeWidth={2} aria-hidden />
              <input
                type="color"
                aria-label="Pick a colour"
                value={valid ? hex : "#1C7D58"}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </span>
            <Input id="brand-hex" value={hex} onChange={(e) => setHex(e.target.value)} className="h-9 w-32 font-mono uppercase" invalid={!valid && hex.length > 0} placeholder="#1C7D58" />
          </div>
        </div>

        {/* Live preview using the (contrast-safe) accent. */}
        <div className="flex items-center gap-2" style={{ ["--preview" as string]: safe }}>
          <span className="inline-flex h-9 items-center rounded-control px-3.5 text-[13px] font-medium text-white" style={{ backgroundColor: "var(--preview)" }}>
            Primary action
          </span>
          <span className="inline-flex items-center gap-1 rounded-chip px-2 py-1 text-[12px] font-semibold" style={{ color: "var(--preview)", backgroundColor: `color-mix(in srgb, ${safe} 12%, transparent)` }}>
            Highlight
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use ${c}`}
            onClick={() => setHex(c)}
            className={cn("size-7 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110", hex.toUpperCase() === c ? "ring-2 ring-text" : "ring-1 ring-border")}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {adjusted && (
        <div className="flex items-start gap-2 rounded-control border border-border bg-surface-2/50 px-3 py-2.5 text-[12px] text-text-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-text-3" strokeWidth={2} aria-hidden />
          <span>This colour is light (contrast {ratio.toFixed(1)}:1 on white). Phila automatically darkens it to <span className="font-mono">{safe}</span> where text must stay legible  your exact colour is still used for fills and highlights.</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={save} loading={pending} disabled={!valid || !dirty}>
          <Check className="size-4" strokeWidth={2.4} aria-hidden /> Save brand colour
        </Button>
      </div>
    </div>
  );
}
