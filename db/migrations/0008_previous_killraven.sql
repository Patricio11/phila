CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"org_id" text NOT NULL,
	"number" text NOT NULL,
	"service_name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;