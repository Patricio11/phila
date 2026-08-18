"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Batch 4g - a small, dependency-free emoji picker for the team chat. A curated
 * set (what a practice team actually uses), grouped + keyword-searchable. Native
 * glyphs - the OS renders them, so nothing to download and nothing to license.
 */

const GROUPS: { name: string; items: [string, string][] }[] = [
  { name: "Smileys", items: [
    ["😀", "grin smile happy"], ["😃", "smile happy"], ["😄", "smile laugh"], ["😁", "grin beam"], ["😆", "laugh squint"], ["😅", "sweat smile relief"], ["🤣", "rofl laugh"], ["😂", "joy laugh tears"],
    ["🙂", "slight smile"], ["😊", "blush smile"], ["😇", "halo angel"], ["🥰", "love hearts"], ["😍", "heart eyes love"], ["🤩", "star struck wow"], ["😘", "kiss"], ["😉", "wink"],
    ["😌", "relieved calm"], ["😎", "cool sunglasses"], ["🤗", "hug"], ["🤔", "thinking hmm"], ["🤨", "raised eyebrow"], ["😐", "neutral"], ["😑", "expressionless"], ["🙄", "eye roll"],
    ["😏", "smirk"], ["😴", "sleep tired"], ["🤒", "sick thermometer"], ["🤕", "hurt bandage"], ["🤧", "sneeze"], ["😷", "mask"], ["🥳", "party celebrate"], ["😢", "cry sad tear"],
    ["😭", "sob cry"], ["😤", "huff frustrated"], ["😡", "angry"], ["😳", "flushed"], ["🥺", "pleading please"], ["😬", "grimace awkward"], ["😱", "scream shock"], ["🤯", "mind blown"],
  ] },
  { name: "Gestures", items: [
    ["👍", "thumbs up yes ok good"], ["👎", "thumbs down no"], ["👏", "clap applause"], ["🙌", "raised hands hooray"], ["🙏", "pray thanks please"], ["👋", "wave hello bye"], ["🤝", "handshake deal"], ["✌️", "peace victory"],
    ["🤞", "fingers crossed luck"], ["👌", "ok perfect"], ["💪", "strong muscle"], ["👉", "point right"], ["👈", "point left"], ["☝️", "point up"], ["✋", "stop hand"], ["🫶", "heart hands"],
  ] },
  { name: "Hearts", items: [
    ["❤️", "heart love red"], ["🧡", "orange heart"], ["💛", "yellow heart"], ["💚", "green heart"], ["💙", "blue heart"], ["💜", "purple heart"], ["🤍", "white heart"], ["💔", "broken heart"],
    ["💕", "two hearts"], ["💖", "sparkling heart"], ["💗", "growing heart"], ["✨", "sparkles"], ["🌟", "star glow"], ["⭐", "star"], ["🔥", "fire hot"], ["💯", "hundred perfect"],
  ] },
  { name: "Work", items: [
    ["✅", "check done tick yes"], ["❌", "cross no wrong"], ["⚠️", "warning caution"], ["❗", "exclamation important"], ["❓", "question"], ["📌", "pin note"], ["📎", "paperclip attach"], ["📝", "memo note write"],
    ["📋", "clipboard list"], ["📅", "calendar date"], ["⏰", "alarm clock time"], ["⏳", "hourglass wait"], ["📞", "phone call"], ["💬", "speech chat"], ["📣", "megaphone announce"], ["🔔", "bell notify"],
    ["💡", "idea light bulb"], ["🎯", "target goal"], ["🚀", "rocket launch go"], ["🎉", "party tada celebrate"], ["🏆", "trophy win"], ["🧠", "brain mind"], ["🩺", "stethoscope health doctor"], ["💊", "pill medicine"],
    ["🌱", "seedling growth"], ["☕", "coffee tea break"], ["🍰", "cake birthday"], ["🌈", "rainbow hope"], ["☀️", "sun sunny"], ["🌧️", "rain"], ["🕊️", "dove peace"], ["🙈", "see no evil monkey"],
  ] },
];

/** The quick-react bar - the six a team reaches for most. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🙏", "👏", "✅"];

export function EmojiPicker({ onPick, onClose, className }: { onPick: (emoji: string) => void; onClose?: () => void; className?: string }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // Close on outside click / Escape.
  useEffect(() => {
    if (!onClose) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return null;
    return GROUPS.flatMap((g) => g.items).filter(([, kw]) => kw.includes(query)).slice(0, 48);
  }, [query]);
  const shown = results ?? GROUPS[tab]!.items;

  return (
    <div ref={boxRef} role="dialog" aria-label="Pick an emoji" className={cn("w-[300px] max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-2 shadow-[var(--shadow-card)]", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-3" strokeWidth={2} aria-hidden />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emoji…" aria-label="Search emoji" className="h-8 w-full rounded-control border border-border bg-surface pl-8 pr-2 text-[12.5px] text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" />
      </div>
      {!results && (
        <div className="mt-1.5 flex gap-1 overflow-x-auto">
          {GROUPS.map((g, i) => (
            <button key={g.name} type="button" onClick={() => setTab(i)} className={cn("h-7 shrink-0 rounded-[6px] px-2 text-[11.5px] font-medium transition-colors", tab === i ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-hover hover:text-text")}>{g.name}</button>
          ))}
        </div>
      )}
      <div className="mt-1.5 grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="col-span-8 py-6 text-center text-[12px] text-text-3">No emoji match.</p>
        ) : shown.map(([e, kw]) => (
          <button key={e + kw} type="button" onClick={() => onPick(e)} title={kw.split(" ")[0]} aria-label={kw.split(" ").slice(0, 2).join(" ")} className="flex size-8 items-center justify-center rounded-[6px] text-[20px] leading-none transition-colors hover:bg-surface-hover">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
