ALTER TABLE "document_requests" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "counsellor_id" text;