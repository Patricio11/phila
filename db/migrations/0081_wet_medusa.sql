ALTER TABLE "message_threads" ADD COLUMN "client_nudged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "org_messaging_settings" ADD COLUMN "message_alerts_staff" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "org_messaging_settings" ADD COLUMN "message_alerts_clients" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "thread_members" ADD COLUMN "nudged_at" timestamp with time zone;