CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"client_id" text NOT NULL,
	"counsellor_id" text NOT NULL,
	"service_id" text NOT NULL,
	"type" text NOT NULL,
	"room_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"state" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;