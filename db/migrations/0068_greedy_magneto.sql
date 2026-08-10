ALTER TABLE "counsellor_availability" ADD COLUMN "mode" text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD COLUMN "photo_key" text;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD COLUMN "photo_bytes" integer DEFAULT 0 NOT NULL;