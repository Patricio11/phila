CREATE TABLE "onboarding_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_onboarding_docs" (
	"org_id" text NOT NULL,
	"requirement_id" text NOT NULL,
	"status" text NOT NULL,
	"file_name" text,
	"uploaded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "org_onboarding_docs" ADD CONSTRAINT "org_onboarding_docs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_onboarding_uq" ON "org_onboarding_docs" USING btree ("org_id","requirement_id");