CREATE TABLE "form_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"form_id" text NOT NULL,
	"client_id" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"answers" jsonb,
	"sent_by" text,
	"sent_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"fields" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_assign_token_uq" ON "form_assignments" USING btree ("token");--> statement-breakpoint
CREATE INDEX "form_assign_form_idx" ON "form_assignments" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_assign_client_idx" ON "form_assignments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "forms_org_idx" ON "forms" USING btree ("org_id");