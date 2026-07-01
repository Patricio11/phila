ALTER TABLE "message_threads" ADD COLUMN "pair_key" text;--> statement-breakpoint
-- Backfill pair_key for existing DIRECT threads: `<org_id>:<sorted member ids>`.
-- If the old find-then-create race already produced duplicate threads for a pair,
-- only the earliest one gets the key; the rest stay NULL so the unique index below
-- can't fail (Postgres treats NULLs as distinct). New messages consolidate on the
-- keyed (canonical) thread.
WITH pairs AS (
  SELECT mt.id AS thread_id,
         mt.org_id || ':' || (
           SELECT string_agg(tm.user_id, ':' ORDER BY tm.user_id)
           FROM "thread_members" tm WHERE tm.thread_id = mt.id
         ) AS pair_key,
         mt.created_at
  FROM "message_threads" mt
  WHERE mt.kind = 'direct'
),
ranked AS (
  SELECT thread_id, pair_key,
         row_number() OVER (PARTITION BY pair_key ORDER BY created_at ASC, thread_id ASC) AS rn
  FROM pairs
)
UPDATE "message_threads" t SET "pair_key" = r.pair_key
FROM ranked r
WHERE t.id = r.thread_id AND r.rn = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "thread_pair_uq" ON "message_threads" USING btree ("pair_key");
