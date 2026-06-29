"use client";

import { useState } from "react";
import { ShieldCheck, Video as VideoIcon, PhoneOff, RotateCcw } from "lucide-react";
import { LiveKitRoom, VideoConference, PreJoin, RoomAudioRenderer, type LocalUserChoices } from "@livekit/components-react";
import "@livekit/components-styles";

interface Props {
  appointmentId: string;
  sig: string;
  orgName: string;
  hostName: string;
  serviceName: string;
  startsAtLabel: string;
  defaultName: string;
  isHost: boolean;
}

/**
 * The full video experience (Phase 13): a calm, branded **waiting room** (camera +
 * mic preview, device pickers) → a real **LiveKit call** with camera/mic toggles
 * (switch video off for an audio-only call), screen share, and leave. The token is
 * minted server-side; nothing is recorded.
 */
export function VideoSession({ appointmentId, sig, orgName, hostName, serviceName, startsAtLabel, defaultName, isHost }: Props) {
  const [choices, setChoices] = useState<LocalUserChoices>();
  const [token, setToken] = useState<string>();
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [ended, setEnded] = useState(false);

  const join = async (c: LocalUserChoices) => {
    setError(undefined);
    setChoices(c);
    try {
      const res = await fetch("/api/video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, t: sig, name: c.username }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't join the room."); setChoices(undefined); return; }
      setToken(data.token);
      setUrl(data.url);
    } catch {
      setError("Couldn't reach the video server. Is it running?");
      setChoices(undefined);
    }
  };

  // In the call.
  if (token && url) {
    return (
      <div className="h-[100dvh] w-full bg-[#0b0f0e]" data-lk-theme="default">
        <LiveKitRoom
          serverUrl={url}
          token={token}
          connect
          video={choices?.videoEnabled ?? true}
          audio={choices?.audioEnabled ?? true}
          onDisconnected={() => { setEnded(true); setToken(undefined); }}
          style={{ height: "100%" }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }

  // Left the call.
  if (ended) {
    return (
      <Shell orgName={orgName} subtitle="Session ended">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldCheck className="size-7" strokeWidth={2} aria-hidden />
          </div>
          <h2 className="text-[19px] font-[680] text-text">You&apos;ve left the session</h2>
          <p className="text-[14px] text-text-2">Nothing was recorded. You can rejoin if the session is still going.</p>
          <button onClick={() => { setEnded(false); setChoices(undefined); }} className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-[14px] font-medium text-white hover:brightness-95">
            <RotateCcw className="size-4" strokeWidth={2} aria-hidden /> Rejoin
          </button>
        </div>
      </Shell>
    );
  }

  // Waiting room (pre-join).
  return (
    <Shell orgName={orgName} subtitle={isHost ? "Counsellor view" : "Secure session"}>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-card border border-border bg-[#0b0f0e]" data-lk-theme="default">
          <PreJoin
            defaults={{ username: defaultName, videoEnabled: true, audioEnabled: true }}
            onSubmit={join}
            onError={(e) => setError(e.message)}
            joinLabel={isHost ? "Start session" : "Join session"}
            persistUserChoices
          />
        </div>
        <div className="flex flex-col justify-center gap-4 py-2">
          <div>
            <div className="text-[12px] font-medium uppercase tracking-wide text-text-3">{serviceName}</div>
            <h2 className="mt-1 text-[20px] font-[700] text-text">{isHost ? "Your client will join shortly" : `${hostName} will be with you shortly`}</h2>
            <p className="mt-1 text-[13.5px] text-text-2">{startsAtLabel}</p>
          </div>
          <ul className="space-y-2.5 text-[13px] text-text-2">
            <Reassure icon={ShieldCheck}>Private &amp; encrypted  no one else can join without the link.</Reassure>
            <Reassure icon={VideoIcon}>Check your camera and mic on the left. You can turn the camera off for an audio-only call.</Reassure>
            <Reassure icon={PhoneOff}>Nothing is recorded. Leave any time.</Reassure>
          </ul>
          {error && (
            <div className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{error}</div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ orgName, subtitle, children }: { orgName: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-white"><VideoIcon className="size-4" strokeWidth={2.2} aria-hidden /></span>
          <div>
            <div className="text-[14px] font-[680] text-text">{orgName}</div>
            <div className="text-[11.5px] text-text-3">{subtitle}</div>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent">
          <ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden /> Secure
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center px-4 py-6">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}

function Reassure({ icon: Icon, children }: { icon: typeof ShieldCheck; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </li>
  );
}
