CREATE TABLE "document_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"client_id" text,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"client_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone,
	"fulfilled_document_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"shared_with" text NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"folder_id" text,
	"client_id" text,
	"counsellor_id" text,
	"session_id" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"storage_provider" text DEFAULT 'supabase' NOT NULL,
	"storage_key" text,
	"content_type" text,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"size_label" text NOT NULL,
	"scan_status" text DEFAULT 'pending' NOT NULL,
	"uploaded_by" text,
	"shared_by" text NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "org_storage_usage" (
	"org_id" text PRIMARY KEY NOT NULL,
	"bytes_used" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_storage_usage" ADD CONSTRAINT "org_storage_usage_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doc_folders_org_idx" ON "document_folders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "doc_requests_client_idx" ON "document_requests" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_share_uq" ON "document_shares" USING btree ("target_type","target_id","shared_with");--> statement-breakpoint
CREATE INDEX "documents_org_idx" ON "documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "documents" USING btree ("client_id");--> statement-breakpoint
-- Backfill: bring existing client_documents into the generalized documents table.
-- Legacy client docs were shown in /me/documents, so they are client_visible + treated as already scanned.
INSERT INTO "documents" ("id","org_id","client_id","name","kind","visibility","storage_provider","size_label","scan_status","shared_by","bytes","created_at")
SELECT "id","org_id","client_id","name","kind",'client_visible','supabase',"size_label",'clean',"shared_by",0,"created_at"
FROM "client_documents"
ON CONFLICT ("id") DO NOTHING;