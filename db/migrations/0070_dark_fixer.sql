ALTER TABLE "org_onboarding_docs" ADD COLUMN "storage_backend" text DEFAULT 'supabase' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "brand_logo_backend" text DEFAULT 'supabase' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_messages" ADD COLUMN "attachment_backend" text DEFAULT 'supabase' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD COLUMN "photo_backend" text DEFAULT 'supabase' NOT NULL;