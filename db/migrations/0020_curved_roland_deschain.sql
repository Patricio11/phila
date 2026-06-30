CREATE TABLE "org_public_pages" (
	"org_id" text PRIMARY KEY NOT NULL,
	"hero_headline" text,
	"hero_subtitle" text,
	"show_online_badge" boolean DEFAULT true NOT NULL,
	"about_title" text DEFAULT 'About us' NOT NULL,
	"about_body" text,
	"show_about" boolean DEFAULT true NOT NULL,
	"approach_title" text DEFAULT 'How we work' NOT NULL,
	"approach_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_approach" boolean DEFAULT true NOT NULL,
	"show_services" boolean DEFAULT true NOT NULL,
	"show_team" boolean DEFAULT true NOT NULL,
	"faq_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_faq" boolean DEFAULT true NOT NULL,
	"show_contact" boolean DEFAULT true NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"cta_text" text DEFAULT 'Book a session' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_page_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_public_pages" ADD CONSTRAINT "org_public_pages_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_page_events" ADD CONSTRAINT "public_page_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ppe_org_at_idx" ON "public_page_events" USING btree ("org_id","at");