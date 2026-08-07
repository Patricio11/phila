ALTER TABLE "document_folders" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "document_folders" ADD COLUMN "submissions_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "external_url" text;