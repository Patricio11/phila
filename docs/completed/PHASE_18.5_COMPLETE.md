# Phase 18.5  Team messaging: real-time staff chat ✅

*Shipped: 2026-07-01 · Part B · the mock staff chat became **real, persisted, and live***

> Internal staff chat was 100% mock  the send only logged, threads came from fixtures. Phase 18.5
> makes it real: **Neon is the source of truth**, with **Supabase Realtime** for live delivery +
> presence. It's **Dormant-by-Default**  without the Supabase anon key the chat falls back to
> load-on-refresh; messages persist regardless of the socket, so nothing is ever lost.

---

## Real persistence
Four tables  `message_threads` · `thread_members` (with a read cursor for unread) · `team_messages` ·
`user_presence` (migration `0022`; RLS on the three org-scoped tables, seeded from the fixture threads).
`db/queries/messages.ts` lists threads (messages + unread + names/roles), sends (find-or-create the 1:1
thread), and marks-read. The provider is DB-backed: `listTeamThreads(userId, orgId)`, `sendTeamMessage`
(persists), `markThreadRead`.

## Group chat
Create a named group + invite teammates (`createGroup`); group threads carry a member count + group avatar
and **per-message sender names**. One unified send  by `threadId` for a group/existing thread, or by
`toUserId` for a new 1:1.

## Supabase Realtime  live delivery + presence
`lib/messaging/realtime.ts` broadcasts each new message to its **per-thread channel** (keyed by the
unguessable `mt_<uuid>` id) on send; the client subscribes via `@supabase/supabase-js` for **instant
delivery** (dedup + unread bump; own messages skipped) and joins an **org Presence channel** for real
**online dots** + "Active now", with smooth auto-scroll. The super-admin pastes the Supabase **anon
(public) key** in Admin → Integrations → Phila Storage.

## Follow-ups
- Live **"you were added to a group"** push (new members get the group on the fly, no reload).
- **Typing indicators** (client→client via the thread channel; "…is typing" in the header).
- **Message edit + delete** (author-only, live in-place, with an "· edited" marker + a
  "This message was deleted" state).

## Attachments
A paperclip in the composer → presigned upload to **Phila Storage** (validates type + size + the org
quota) → the message carries the file; an attachment chip (name + size + open via short-TTL signed URL,
members-only, audited). **Attachment bytes count against the org's storage** (`org_storage_usage`).

## Private channels + Supabase RLS (opt-in)
The server mints a short-lived Supabase-compatible JWT scoped to the user's channels (a `topics` claim);
the client uses **private channels** + that token when the super-admin switches it on (JWT secret + the
one-time RLS SQL in `docs/SUPABASE_REALTIME_SETUP.md`); the token refreshes as threads change. **Off by
default**  public per-thread channels keyed by the unguessable `mt_<uuid>` id remain the fallback.

## Verification
Staff chat persists, groups work, and messages + presence are live across sessions  proven with two
roles side-by-side. `tsc` / `eslint` / `build` + 119 tests green throughout the four commits.
