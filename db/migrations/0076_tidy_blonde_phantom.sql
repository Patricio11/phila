CREATE TABLE "document_share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"token" text NOT NULL,
	"document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"folder_id" text,
	"company_id" text,
	"recipient_email" text NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"download_count" integer DEFAULT 0 NOT NULL,
	"last_download_at" timestamp with time zone,
	CONSTRAINT "document_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_links_org_idx" ON "document_share_links" USING btree ("org_id");