CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"vat_rate_percent" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "booking_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "payments" jsonb DEFAULT '{}'::jsonb NOT NULL;