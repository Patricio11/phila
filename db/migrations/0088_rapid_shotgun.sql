ALTER TABLE "form_assignments" ADD COLUMN "counsellor_id" text;--> statement-breakpoint
ALTER TABLE "form_assignments" ADD COLUMN "appointment_id" text;--> statement-breakpoint
ALTER TABLE "form_automations" ADD COLUMN "recipient" text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_automations" ADD COLUMN "every_session" boolean DEFAULT false NOT NULL;