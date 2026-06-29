ALTER TABLE "appointments" ADD COLUMN "reminded_24h" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminded_1h" boolean DEFAULT false NOT NULL;