ALTER TABLE "session_notes" ADD COLUMN "supervisor_id" text;--> statement-breakpoint
ALTER TABLE "session_notes" ADD COLUMN "supervisor_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session_notes" ADD COLUMN "supervisor_decision" text;--> statement-breakpoint
ALTER TABLE "session_notes" ADD COLUMN "supervisor_comment" text;