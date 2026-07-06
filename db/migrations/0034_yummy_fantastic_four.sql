ALTER TABLE "org_members" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_members" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;