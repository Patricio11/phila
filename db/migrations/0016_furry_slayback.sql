CREATE TABLE "ai_providers" (
	"provider" text PRIMARY KEY NOT NULL,
	"api_key_enc" text,
	"model" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
