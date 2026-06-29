CREATE TABLE "credit_balances" (
	"org_id" text NOT NULL,
	"channel" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"channel" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" text,
	"idempotency_key" text NOT NULL,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"channel" text NOT NULL,
	"to_masked" text NOT NULL,
	"template_key" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"provider_message_id" text,
	"cost_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"channel" text NOT NULL,
	"key" text NOT NULL,
	"body" text NOT NULL,
	"whatsapp_template_name" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_messaging_settings" (
	"org_id" text PRIMARY KEY NOT NULL,
	"whatsapp_enabled" boolean DEFAULT false NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"email_reply_to" text,
	"email_from_name" text,
	"quiet_start" text,
	"quiet_end" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_connections" (
	"org_id" text PRIMARY KEY NOT NULL,
	"phone_number_id" text,
	"waba_id" text,
	"access_token_enc" text,
	"app_secret_enc" text,
	"verify_token" text,
	"status" text DEFAULT 'off' NOT NULL,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_opt_outs" ADD CONSTRAINT "message_opt_outs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_messaging_settings" ADD CONSTRAINT "org_messaging_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_balance_uq" ON "credit_balances" USING btree ("org_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idem_uq" ON "credit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "opt_out_uq" ON "message_opt_outs" USING btree ("org_id","channel","target");