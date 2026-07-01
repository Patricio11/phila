ALTER TABLE "form_assignments" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "form_assignments" ADD COLUMN "respondent_name" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "theme" jsonb;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "share_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "forms_share_token_uq" ON "forms" USING btree ("share_token");