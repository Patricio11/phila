"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { contrastSafeAccent } from "@/lib/contrast";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const SWATCHES = ["#1C7D58", "#3C7FB0", "#6b4f8a", "#9a6418", "#C2554D", "#0E7C7B"];

/** Mock public-page editor (DESIGN.md §9). Phase 17 persists to `org_public_pages`. */
export function PublicPageEditor({
  slug,
  initialAccent,
  initialIntro,
}: {
  slug: string;
  initialAccent: string;
  initialIntro: string;
}) {
  const { toast } = useToast();
  const [accent, setAccent] = useState(initialAccent);
  const [intro, setIntro] = useState(initialIntro);
  const safe = contrastSafeAccent(accent);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pp-intro">Intro</Label>
        <Textarea id="pp-intro" value={intro} onChange={(e) => setIntro(e.target.value)} className="min-h-[80px]" />
      </div>

      <div>
        <Label>Brand accent</Label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              aria-label={`Use ${c}`}
              className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-all", accent === c ? "ring-text" : "ring-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="ml-1 text-[11.5px] text-text-3">
            Auto-darkened to {safe} on the page if it fails contrast.
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pp-seo">SEO title</Label>
        <Input id="pp-seo" defaultValue="Masizakhe Counselling  counselling in Gauteng" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => toast({ tone: "success", title: "Public page saved", description: "Changes go live on your micro-site." })}>
          Save changes
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/o/${slug}`} target="_blank">
            View live <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
