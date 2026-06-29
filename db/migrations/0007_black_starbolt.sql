CREATE TABLE "care_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"author_counsellor_id" text NOT NULL,
	"summary" text NOT NULL,
	"tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_step" text,
	"shared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "client_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"size_label" text NOT NULL,
	"shared_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_measures" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"tool" text NOT NULL,
	"score" integer NOT NULL,
	"taken_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"author_counsellor_id" text NOT NULL,
	"body" text NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"signed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;