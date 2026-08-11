ALTER TABLE "companies" ADD COLUMN "booking_mode" text DEFAULT 'self_book' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "intake_form_id" text;--> statement-breakpoint
ALTER TABLE "form_assignments" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "waitlist_on_submit" boolean DEFAULT false NOT NULL;