-- Phila — scheduling integrity (Phase 11). DB-enforced no-double-booking via
-- GiST exclusion constraints: race-free and atomic, the backbone the engine
-- trusts so two concurrent bookings can never claim the same counsellor or room.
-- A booking's window is [starts_at, starts_at + duration). Cancelled sessions
-- don't reserve time. Idempotent. Apply: npm run db:constraints
--##
create extension if not exists btree_gist;
--##
-- timestamptz + interval is only STABLE, so it can't sit in an index expression.
-- A minute-interval add is deterministic, so wrap it in an IMMUTABLE function.
create or replace function appt_window(ts timestamptz, mins int) returns tstzrange
  language sql immutable as $$ select tstzrange(ts, ts + make_interval(mins => mins)) $$;
--##
alter table appointments drop constraint if exists appt_no_counsellor_overlap;
--##
alter table appointments add constraint appt_no_counsellor_overlap
  exclude using gist (
    counsellor_id with =,
    appt_window(starts_at, duration_min) with &&
  ) where (state <> 'cancelled')
  deferrable initially deferred;
--##
alter table appointments drop constraint if exists appt_no_room_overlap;
--##
alter table appointments add constraint appt_no_room_overlap
  exclude using gist (
    room_id with =,
    appt_window(starts_at, duration_min) with &&
  ) where (room_id is not null and state <> 'cancelled')
  deferrable initially deferred;
