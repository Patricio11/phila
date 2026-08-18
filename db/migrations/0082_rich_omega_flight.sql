CREATE TABLE "dead_letters" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"reason" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_number_health" (
	"org_id" text PRIMARY KEY NOT NULL,
	"quality" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"daily_limit" integer DEFAULT -1 NOT NULL,
	"tier_label" text,
	"display_phone" text,
	"flagged_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD COLUMN "display_phone" text;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD COLUMN "verified_name" text;--> statement-breakpoint
ALTER TABLE "dead_letters" ADD CONSTRAINT "dead_letters_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_number_health" ADD CONSTRAINT "whatsapp_number_health_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dead_letters_org_idx" ON "dead_letters" USING btree ("org_id","at");