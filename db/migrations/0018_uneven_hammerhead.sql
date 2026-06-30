CREATE TABLE "platform_integrations" (
	"key" text PRIMARY KEY NOT NULL,
	"credentials_enc" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
