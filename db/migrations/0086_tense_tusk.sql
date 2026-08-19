ALTER TABLE "org_messaging_settings" ALTER COLUMN "crisis_support" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "crisis_support_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Batch 4m: the practice-level switch now means "opt out once Phila has switched the function on" - existing rows follow the new default.
UPDATE "org_messaging_settings" SET "crisis_support" = true;
