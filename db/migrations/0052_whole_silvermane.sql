CREATE TABLE "public_contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_public_pages" ADD COLUMN "socials" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "org_public_pages" ADD COLUMN "show_socials" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org_public_pages" ADD COLUMN "show_contact_form" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org_public_pages" ADD COLUMN "contact_form_email" text;--> statement-breakpoint
ALTER TABLE "public_contact_messages" ADD CONSTRAINT "public_contact_messages_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;