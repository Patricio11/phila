CREATE TABLE "languages" (
	"code" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_native" text NOT NULL,
	"tier" integer NOT NULL,
	"rail_capable" boolean DEFAULT false NOT NULL,
	"rtl" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_language_settings" (
	"org_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"default_language" text DEFAULT 'en-ZA' NOT NULL,
	"rail_enabled" boolean DEFAULT false NOT NULL,
	"retention_enabled" boolean DEFAULT false NOT NULL,
	"monthly_minute_cap" integer
);
--> statement-breakpoint
ALTER TABLE "counsellors" ADD COLUMN "spoken_languages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "org_language_settings" ADD CONSTRAINT "org_language_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;