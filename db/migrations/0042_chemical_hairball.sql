CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"price_cents" integer NOT NULL,
	"seats" integer,
	"ai_tokens" integer DEFAULT 0 NOT NULL,
	"video_minutes" integer DEFAULT 0 NOT NULL,
	"messaging" boolean DEFAULT false NOT NULL,
	"rooms" integer,
	"storage_gb" integer DEFAULT 5 NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"ngo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
