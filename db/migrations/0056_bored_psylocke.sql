CREATE TABLE "counsellor_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"counsellor_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counsellor_availability" ADD CONSTRAINT "counsellor_availability_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;