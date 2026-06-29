CREATE TABLE "funder_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"funder_id" text NOT NULL,
	"grant_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funders" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grant_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" text NOT NULL,
	"client_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grant_indicators" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"metric" text NOT NULL,
	"target" integer NOT NULL,
	"unit" text NOT NULL,
	"rule" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grant_narratives" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grants" (
	"id" text PRIMARY KEY NOT NULL,
	"funder_id" text NOT NULL,
	"org_id" text NOT NULL,
	"title" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"restricted" boolean DEFAULT false NOT NULL,
	"reporting_schedule" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funders" ADD CONSTRAINT "funders_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grants" ADD CONSTRAINT "grants_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funder_contact_uq" ON "funder_contacts" USING btree ("user_id","funder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grant_alloc_uq" ON "grant_allocations" USING btree ("grant_id","client_id");