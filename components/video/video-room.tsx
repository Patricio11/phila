"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import * as React from "react";
import {
  Link2,
  Mic,
  MicOff,
  PhoneOff,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * VideoRoom shell (DESIGN.md §6/§8)  a full-screen pre-join + in-session room
 * for online sessions, or the **paste-link fallback** when the org's in-app video
 * is off (Dormant-by-Default). All mock  no WebRTC; LiveKit is wired in Phase 13.
 * On end, control returns to the note.
 */
export function VideoRoom({
  open,
  onClose,
  clientName,
  videoEnabled,
}: {
  open: boolean;
  onClose: () => void;
  clientName: string;
  videoEnabled: boolean;
}) {
  const mounted = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [phase, setPhase] = useState<"prejoin" | "in_call">("prejoin");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [link, setLink] = useState("");

  if (!mounted || !open) return null;

  // Reset to pre-join on close so the next open starts fresh (no effect needed).
  const close = () => {
    setPhase("prejoin");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0b0f0d] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="text-[13.5px] font-medium text-white/80">
          {videoEnabled ? "Secure session room" : "Online session"} · {clientName}
        </div>
        <button onClick={close} className="rounded-control px-3 py-1.5 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          Close
        </button>
      </div>

      {!videoEnabled ? (
        <PasteLink clientName={clientName} link={link} setLink={setLink} onClose={close} />
      ) : phase === "prejoin" ? (
        <PreJoin clientName={clientName} mic={mic} cam={cam} setMic={setMic} setCam={setCam} onJoin={() => setPhase("in_call")} />
      ) : (
        <InCall clientName={clientName} mic={mic} cam={cam} setMic={setMic} setCam={setCam} onEnd={close} />
      )}
    </div>,
    document.body,
  );
}

function Stage({ name, muted, camOff }: { name: string; muted?: boolean; camOff?: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-[#11201a] to-[#0c1411]">
      {camOff ? (
        <div className="flex size-24 items-center justify-center rounded-full bg-white/10 text-[28px] font-semibold text-white/80">{initials(name)}</div>
      ) : (
        <div className="text-center text-white/40">
          <VideoIcon className="mx-auto size-10" strokeWidth={1.5} aria-hidden />
          <p className="mt-2 text-[12px]">Camera preview (mock)</p>
        </div>
      )}
      {muted && (
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px]">
          <MicOff className="size-3.5" aria-hidden /> Muted
        </span>
      )}
    </div>
  );
}

function PreJoin({ clientName, mic, cam, setMic, setCam, onJoin }: { clientName: string; mic: boolean; cam: boolean; setMic: (v: boolean) => void; setCam: (v: boolean) => void; onJoin: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
      <div className="aspect-video w-full max-w-2xl">
        <Stage name={clientName} muted={!mic} camOff={!cam} />
      </div>
      <div className="flex items-center gap-3">
        <CircleToggle on={mic} onClick={() => setMic(!mic)} OnIcon={Mic} OffIcon={MicOff} label="microphone" />
        <CircleToggle on={cam} onClick={() => setCam(!cam)} OnIcon={VideoIcon} OffIcon={VideoOff} label="camera" />
      </div>
      <Button size="lg" onClick={onJoin}>Join session</Button>
      <p className="text-[12px] text-white/40">Check your camera and mic, then join. The client joins from their portal.</p>
    </div>
  );
}

function InCall({ clientName, mic, cam, setMic, setCam, onEnd }: { clientName: string; mic: boolean; cam: boolean; setMic: (v: boolean) => void; setCam: (v: boolean) => void; onEnd: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col p-3 sm:p-5">
      <div className="flex-1">
        <Stage name={clientName} />
      </div>
      {/* Self PiP */}
      <div className="absolute bottom-24 right-6 hidden h-28 w-44 overflow-hidden rounded-[12px] border border-white/10 sm:block">
        <Stage name="You" muted={!mic} camOff={!cam} />
      </div>
      {/* Controls */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <CircleToggle on={mic} onClick={() => setMic(!mic)} OnIcon={Mic} OffIcon={MicOff} label="microphone" />
        <CircleToggle on={cam} onClick={() => setCam(!cam)} OnIcon={VideoIcon} OffIcon={VideoOff} label="camera" />
        <button onClick={onEnd} className="inline-flex h-12 items-center gap-2 rounded-full bg-danger px-6 text-[14px] font-medium text-white transition-colors hover:brightness-95" aria-label="End session and return to note">
          <PhoneOff className="size-5" strokeWidth={2} aria-hidden /> End & write note
        </button>
      </div>
    </div>
  );
}

function PasteLink({ clientName, link, setLink, onClose }: { clientName: string; link: string; setLink: (v: string) => void; onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-white/10 text-white/80">
        <Link2 className="size-7" strokeWidth={1.8} aria-hidden />
      </span>
      <div>
        <h2 className="text-[18px] font-[640]">Use your own meeting link</h2>
        <p className="mt-1.5 max-w-sm text-[13px] text-white/50">In-app video is off for this organisation. Paste your Zoom, Meet, or Teams link for the session with {clientName.split(" ")[0]}.</p>
      </div>
      <div className="flex w-full max-w-md gap-2">
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="bg-white/10 text-white placeholder:text-white/40" />
        <Button asChild disabled={!link.trim()}>
          <a href={link.trim() || undefined} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!link.trim()) e.preventDefault(); }}>Open</a>
        </Button>
      </div>
      <button onClick={onClose} className="text-[13px] text-white/50 hover:text-white">Back to the session</button>
    </div>
  );
}

function CircleToggle({ on, onClick, OnIcon, OffIcon, label }: { on: boolean; onClick: () => void; OnIcon: typeof Mic; OffIcon: typeof MicOff; label: string }) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${on ? "Turn off" : "Turn on"} ${label}`}
      className={cn("inline-flex size-12 items-center justify-center rounded-full transition-colors", on ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-[#0b0f0d]")}
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
