import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import type { FormTheme } from "@/lib/domain/types";

/** Sensible defaults so a half-configured theme still looks intentional. */
export const DEFAULT_THEME: FormTheme = {
  layout: "split",
  hero: {},
  background: { type: "gradient", gradientFrom: "#0f5132", gradientTo: "#1c7d58", gradientAngle: 150, overlayColor: "#0b1f17", overlayOpacity: 0 },
};

function hexToRgba(hex: string, opacityPct: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacityPct)) / 100})`;
}

/** The panel's background (gradient / solid / image). Pass the resolved image URL. */
export function backgroundStyle(bg: FormTheme["background"], imageUrl?: string | null): CSSProperties {
  if (bg.type === "solid") return { backgroundColor: bg.color ?? "#1c7d58" };
  if (bg.type === "image") {
    return imageUrl
      ? { backgroundImage: `url("${imageUrl}")`, backgroundSize: bg.imageFit ?? "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundColor: "#0b1f17" }
      : { backgroundColor: "#0b1f17" };
  }
  const from = bg.gradientFrom ?? "#0f5132";
  const to = bg.gradientTo ?? "#1c7d58";
  return { backgroundImage: `linear-gradient(${bg.gradientAngle ?? 150}deg, ${from}, ${to})` };
}

export function overlayStyle(bg: FormTheme["background"]): CSSProperties | null {
  const op = bg.overlayOpacity ?? 0;
  if (op <= 0) return null;
  return { backgroundColor: hexToRgba(bg.overlayColor ?? "#000000", op) };
}

/** The branded hero panel  brand, heading, subheading, bullets, footnote. White text. */
export function HeroPanel({ theme, orgName, imageUrl }: { theme: FormTheme; orgName: string; imageUrl?: string | null }) {
  const { hero, background } = theme;
  const ov = overlayStyle(background);
  return (
    <div className="relative flex min-h-[220px] flex-col justify-between overflow-hidden p-7 text-white sm:p-9" style={backgroundStyle(background, imageUrl)}>
      {ov && <div className="absolute inset-0" style={ov} aria-hidden />}
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/20 text-[15px] font-[680] backdrop-blur">{orgName.charAt(0)}</span>
          <div className="text-[13px] font-[620] leading-tight opacity-95">{orgName}</div>
        </div>
        {hero.heading && <h2 className="mt-7 text-[clamp(1.5rem,3vw,2.1rem)] font-[720] leading-[1.1] tracking-[-0.02em]">{hero.heading}</h2>}
        {hero.subheading && <p className="mt-3 max-w-sm text-[14px] leading-relaxed opacity-90">{hero.subheading}</p>}
        {hero.bullets && hero.bullets.length > 0 && (
          <ul className="mt-6 space-y-2.5">
            {hero.bullets.filter(Boolean).map((b, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13.5px] opacity-95">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20"><Check className="size-3" strokeWidth={3} aria-hidden /></span>
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hero.footNote && <p className="relative mt-8 text-[11.5px] opacity-70">{hero.footNote}</p>}
    </div>
  );
}
