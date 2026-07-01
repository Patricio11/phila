ALTER TABLE "team_messages" ADD COLUMN "attachment_key" text;--> statement-breakpoint
ALTER TABLE "team_messages" ADD COLUMN "attachment_name" text;--> statement-breakpoint
ALTER TABLE "team_messages" ADD COLUMN "attachment_type" text;--> statement-breakpoint
ALTER TABLE "team_messages" ADD COLUMN "attachment_bytes" bigint;