# Supabase Realtime  private channels (chat security hardening)

The team chat's **live delivery + presence** run on Supabase Realtime. Out of the
box, Phila uses **per-thread channels keyed by an unguessable `mt_<uuid>` id**, so
a channel isn't enumerable  but it is not yet RLS-enforced. This guide switches on
**private, RLS-authorized channels**, so only a thread's members can ever subscribe.

> **This is opt-in and off by default.** Neon stays the source of truth; this only
> governs *who may subscribe* to a realtime channel. If anything goes quiet after
> enabling, switch **Private realtime channels** back off in Admin → Integrations →
> Phila Storage  the chat falls straight back to the working public-channel mode.

## How it works

When private mode is on, Phila mints a short-lived (1 hour), Supabase-compatible
**JWT** per user, signed with your project's **JWT secret**. The token carries a
custom `topics` claim listing exactly the channels that user may use:

- `thread:<id>` for each thread they're a member of,
- `user:<their id>` (their "added to a group" channel),
- `presence:org:<their org id>`.

The browser authenticates Realtime with that token, opens channels as **private**,
and an RLS policy on `realtime.messages` allows a topic only if it's in the token's
`topics` claim. A new group re-mints the token (the client refreshes on change), so
membership stays accurate.

## Setup (one-time, ~2 minutes)

1. **Run the SQL below** in your Supabase project → **SQL Editor**:

```sql
-- Phila: private realtime channels authorized by the token's `topics` claim.
alter table realtime.messages enable row level security;

drop policy if exists "phila_topic_access" on realtime.messages;
create policy "phila_topic_access"
on realtime.messages
for all
to authenticated
using (
  realtime.topic() in (
    select jsonb_array_elements_text(coalesce((auth.jwt() -> 'topics'), '[]'::jsonb))
  )
)
with check (
  realtime.topic() in (
    select jsonb_array_elements_text(coalesce((auth.jwt() -> 'topics'), '[]'::jsonb))
  )
);
```

2. In Supabase → **Project Settings → API**, copy the **JWT Secret**.

3. In Phila → **Admin → Integrations → Phila Storage · Supabase**:
   - paste the **JWT secret**,
   - switch **Private realtime channels (RLS)** on,
   - **Save**.

4. Open the chat as two different users and confirm messages + presence still flow.
   Then, as a check, confirm a user cannot subscribe to a thread they're not in
   (they simply receive nothing on it).

## Rollback

Switch **Private realtime channels** off (or clear the JWT secret) and Save. The
client reverts to public channels immediately  no data is affected.

*Phila · philasa.com · Team messaging · Supabase Realtime hardening*
