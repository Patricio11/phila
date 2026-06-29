# Phase 13 — Video (LiveKit) ✅ core

*Shipped: 2026-06-29 · Part B · real, self-hosted, free online video sessions*

> Goal: real online sessions, owned and in-region. Built on **LiveKit** (open
> source, free) — self-hosted via Docker locally, and the same image in an SA
> region for production. Proven end-to-end against a live local server.

---

## What shipped
- **Self-hosted server** — `phila_livekit/docker-compose.yml` runs the open-source
  `livekit/livekit-server`. `docker compose up` and it's live on `:7880`.
- **Server-side token minting** — `lib/video/livekit.ts`: room-scoped JWTs via
  `livekit-server-sdk` (the API secret never reaches the browser) + **signed,
  unguessable join links** (`/room/<appointmentId>?t=<hmac>`). `app/api/video/token`
  grants access to the appointment's counsellor (signed-in) or anyone with the
  valid signed link (clients, no account needed).
- **Beautiful waiting room** — `components/video/video-session.tsx`: a branded
  pre-join (camera + mic preview, device pickers, name) with calming copy
  ("Your client will join shortly", "Private & encrypted", "Nothing is recorded").
- **Full call** — `<LiveKitRoom>` + `<VideoConference>`: participant grid + a
  control bar with **camera toggle (switch video off → audio-only call)**, mic,
  **screen share**, chat, and **leave**. A clean "you've left / rejoin" screen.
- **Wired everywhere an online session appears** — the booking confirmation
  ("Open my video room"), the client portal `/me` ("Join session", 10-min window),
  and the counsellor's session editor ("Open video room", opens in a new tab so
  notes stay open).
- **No recording by default** — LiveKit retains nothing without egress configured
  (POPIA-safe); recording is a future explicit opt-in.

## How the link works
No raw LiveKit URL is exposed. An online appointment has a stable signed link;
opening it hits Phila's server, which mints a short-lived room-scoped JWT, and the
browser connects to `NEXT_PUBLIC_LIVEKIT_URL`. The room is created on first join.
Full walkthrough: **`docs/LIVEKIT_SETUP.md`**.

## Tests
- **Token unit tests** (2): signed-link sign/verify (per-appointment, forgery
  rejected) + a real room-scoped JWT with publish/subscribe grants.
- **Live E2E** (`tests/e2e/video.spec.ts`): with the Docker server running, the
  counsellor opens an online room, joins from the waiting room, **connects**, and
  the control bar + participant tile render (camera/mic faked via launch args).
  Screenshots: `screenshots/video-waiting-room.png`, `video-room.png`.
- Production build clean (LiveKit components SSR fine).

## Deferred
- **Paste-link fallback** (org pastes Zoom/Meet when it doesn't want in-app video) —
  a small alternative path; the LiveKit path is the primary one and is done.
- **Production self-host hardening** — SA-region VM + TLS (`wss://`) + strong keys.
  Config-only; no app change (`docs/LIVEKIT_SETUP.md`).

**Done when (core, met):** a counsellor and a client meet in a real, encrypted,
self-hosted video room from their appointment link, with camera/mic/screen-share
controls and an audio-only option — nothing recorded.
