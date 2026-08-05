ALTER TABLE "appointments" ADD COLUMN "held_by_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "call_duration_min" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "phone_note" text;