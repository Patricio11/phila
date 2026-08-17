CREATE TABLE "credit_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- Phase 33.1 seed: today's hardcoded packs become editable rows, plus the
-- VoicePhila starter bundle. Idempotent - safe to re-run.
INSERT INTO "credit_bundles" ("id", "channel", "name", "credits", "price_cents", "active", "popular", "sort") VALUES
  ('sms_500',     'sms',   'SMS 500',          500,   25000,  true, false, 1),
  ('sms_2000',    'sms',   'SMS 2 000',        2000,  90000,  true, true,  2),
  ('sms_10000',   'sms',   'SMS 10 000',       10000, 400000, true, false, 3),
  ('email_1000',  'email', 'Email 1 000',      1000,  15000,  true, false, 1),
  ('email_5000',  'email', 'Email 5 000',      5000,  60000,  true, true,  2),
  ('email_25000', 'email', 'Email 25 000',     25000, 250000, true, false, 3),
  ('video_26500', 'video', 'LivePhila 26 500', 26500, 95000,  true, true,  1),
  ('voice_1000',  'voice', 'VoicePhila 1 000', 1000,  80000,  true, true,  1)
ON CONFLICT ("id") DO NOTHING;
