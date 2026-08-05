CREATE TABLE "team_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"phone" text,
	"date_of_birth" text,
	"address" text,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bio" text,
	"qualifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;