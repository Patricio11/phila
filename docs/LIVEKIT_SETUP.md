# LiveKit video  setup & how it works (self-hosted, free)

Phila's online sessions run on **LiveKit**  the open-source WebRTC server
(<https://github.com/livekit/livekit>). It's **free**: self-host it yourself
(below) or use LiveKit Cloud's free tier. We self-host. The app only reads
`LIVEKIT_*` env vars, so the *same code* works against localhost, your own SA
server, or Cloud  you only change the URL + keys.

---

## 1. Run the LiveKit server locally (you have Docker)

```bash
cd phila_livekit
docker compose up          # add -d to background it
```

You'll see it listening on **:7880**. Leave it running. Dev mode auto-uses the
credentials already in `phila/.env.local`:

```
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

> `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` are server-only (mint tokens).
> `NEXT_PUBLIC_LIVEKIT_URL` is the only public one (the browser connects to it).

## 2. Start the app

```bash
cd phila
npm run dev
```

## 3. Try a session end-to-end

**As the counsellor (host):**
1. Sign in as **nomsa@masizakhe.org.za** (`phila1234`).
2. Open an **online** appointment → **Open session** → **Open video room**
   (opens `/room/<appointmentId>` in a new tab; you're the host).
   (A seeded online one: `/room/appt_couns_nomsa_2`.)
3. You land in the **waiting room**  preview your camera/mic, then **Start session**.

**As the client (guest, second window):**
- Use the client's **join link**. Every online booking produces one
  (`/room/<appointmentId>?t=<signed>`); it also shows on the client portal (`/me`)
  and the booking confirmation. Open it in a private/incognito window → waiting
  room → **Join session**.

You'll now see both participants. Try the controls: **camera toggle** (turn video
off for an audio-only call), **mic**, **screen share**, and **leave**.

> Tip: to make a fresh link, complete a public **online** booking at
> `/o/masizakhe/book`  the confirmation shows "Open my video room".

---

## How the link / token works (the "API")

There's no raw LiveKit URL to copy. The flow:

1. An online appointment has a stable **join link**: `/room/<appointmentId>?t=<sig>`.
   `sig` is an HMAC of the appointment id, so links can't be guessed or forged.
2. Opening it hits **Phila's server route** `POST /api/video/token`, which:
   - confirms you're either the appointment's **counsellor** (signed-in) or hold a
     **valid signed link** (clients, no account needed),
   - mints a short-lived **access token**  a JWT scoped to *that one room*  with
     `livekit-server-sdk`, using the API key/secret (which never leave the server).
3. The browser connects to `NEXT_PUBLIC_LIVEKIT_URL` with that token and joins.
   The room is created on first join; there are no rooms to manage by hand.

Code: `lib/video/livekit.ts` (mint + sign), `app/api/video/token/route.ts`
(the endpoint), `components/video/video-session.tsx` (waiting room + call),
`app/room/[appointmentId]/page.tsx` (the page).

---

## Going to production (still self-hosted, still free)

LiveKit Cloud is the zero-ops option, but to self-host in an **SA region** (data
residency):

1. Put a small VM in an SA region (e.g. AWS af-south-1 / Azure SA North).
2. Run `livekit-server` with a real config + **TLS** (a `wss://` domain) and
   **strong API key/secret** (not the dev ones). See LiveKit's deploy docs;
   `docker compose` + a reverse proxy (Caddy/Traefik) for certs is the easy path.
3. Open UDP **50000–60000** (media) + 7880/7881, or run an embedded TURN.
4. In `phila/.env.local` (or your host's env) set:
   ```
   LIVEKIT_URL=wss://video.yourdomain.co.za
   LIVEKIT_API_KEY=<prod key>
   LIVEKIT_API_SECRET=<prod secret>
   NEXT_PUBLIC_LIVEKIT_URL=wss://video.yourdomain.co.za
   ```
   No app code changes.

**No recording** happens unless you explicitly configure LiveKit **egress**  so
sessions are not retained by default (POPIA-safe). Turn it on later only with
explicit org + client consent.

---

## Troubleshooting

- **"Couldn't reach the video server"** → the Docker server isn't running, or
  `NEXT_PUBLIC_LIVEKIT_URL` is wrong. `docker compose up` in `phila_livekit`.
- **Black video / no connect across devices** → dev mode is `localhost` only.
  Test in two tabs on the same machine, or move to Cloud / a public TLS host.
- **"This link isn't valid"** → the appointment isn't online, or the `t` signature
  is stale. Use the latest link from the booking/portal.
- **Camera/mic blocked** → the browser needs camera/mic permission for the site
  (and `localhost`/HTTPS only).
