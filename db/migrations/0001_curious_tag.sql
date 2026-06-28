ALTER TABLE "orgs" ADD COLUMN "brand_accent" text DEFAULT '#1C7D58' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "timezone" text DEFAULT 'Africa/Johannesburg' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "features" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "scheduling" jsonb DEFAULT '{}'::jsonb NOT NULL;