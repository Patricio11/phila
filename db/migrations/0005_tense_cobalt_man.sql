CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"province" text NOT NULL,
	"primary_counsellor_id" text,
	"risk_flag" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "counsellors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"credential_body" text NOT NULL,
	"credential_reg_no" text,
	"credential_status" text NOT NULL,
	"is_supervisor" boolean DEFAULT false NOT NULL,
	"supervisor_id" text
);
--> statement-breakpoint
CREATE TABLE "demographics" (
	"client_id" text PRIMARY KEY NOT NULL,
	"gender" text NOT NULL,
	"population_group" text NOT NULL,
	"employment_status" text NOT NULL,
	"age_band" text NOT NULL,
	"province" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"capacity" integer NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"colour" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"duration_min" integer NOT NULL,
	"price_cents" integer
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"province" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counsellors" ADD CONSTRAINT "counsellors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demographics" ADD CONSTRAINT "demographics_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;