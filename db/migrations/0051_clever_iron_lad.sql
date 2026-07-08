CREATE TABLE "whatsapp_windows" (
	"org_id" text NOT NULL,
	"phone_key" text NOT NULL,
	"last_inbound_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_windows" ADD CONSTRAINT "whatsapp_windows_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_window_uq" ON "whatsapp_windows" USING btree ("org_id","phone_key");