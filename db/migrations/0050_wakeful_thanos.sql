CREATE TABLE "waitlist_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"client_id" text NOT NULL,
	"counsellor_id" text,
	"service_id" text,
	"note" text,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"offered_at" timestamp with time zone,
	"placed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waitlist_org_status_idx" ON "waitlist_entries" USING btree ("org_id","status");