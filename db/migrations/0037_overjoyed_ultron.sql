ALTER TABLE "orgs" ADD COLUMN "onboarding_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "onboarding_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "onboarding_reviewed_at" timestamp with time zone;