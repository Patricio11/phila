CREATE TABLE "voice_call_legs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"appointment_id" text NOT NULL,
	"placed_by" text NOT NULL,
	"status" text DEFAULT 'initiated' NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"billed_min" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "voice_call_legs" ADD CONSTRAINT "voice_call_legs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_legs_appt_idx" ON "voice_call_legs" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "voice_legs_org_idx" ON "voice_call_legs" USING btree ("org_id");