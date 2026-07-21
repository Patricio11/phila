CREATE TABLE "breach_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL,
	"containment" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
