CREATE TABLE "org_video_settings" (
	"org_id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'livekit' NOT NULL,
	"external_url" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_video_settings" ADD CONSTRAINT "org_video_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;