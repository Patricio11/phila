ALTER TABLE "org_onboarding_docs" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "org_onboarding_docs" ADD COLUMN "bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "org_onboarding_docs" ADD COLUMN "review_note" text;