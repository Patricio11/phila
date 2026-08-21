ALTER TABLE "voice_call_legs" ADD COLUMN "provider" text DEFAULT 'twilio' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_call_legs" ADD COLUMN "bridge_to" text;