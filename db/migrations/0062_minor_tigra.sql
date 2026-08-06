ALTER TABLE "clients" ADD COLUMN "home_language" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "interpretation_needed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "language_recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "language_gap_handling" text;