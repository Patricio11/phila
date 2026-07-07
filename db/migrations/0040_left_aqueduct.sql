CREATE TABLE "org_feature_overrides" (
	"org_id" text NOT NULL,
	"feature" text NOT NULL,
	"state" text NOT NULL,
	"reason" text,
	"set_by" text,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_feature_flags" (
	"feature" text PRIMARY KEY NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_feature_overrides" ADD CONSTRAINT "org_feature_overrides_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_feature_override_uq" ON "org_feature_overrides" USING btree ("org_id","feature");