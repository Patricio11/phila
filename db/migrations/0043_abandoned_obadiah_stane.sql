CREATE TABLE "appointment_change_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"appointment_id" text NOT NULL,
	"client_id" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acr_org_status_idx" ON "appointment_change_requests" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "acr_appt_idx" ON "appointment_change_requests" USING btree ("appointment_id");