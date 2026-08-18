CREATE TABLE "team_message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_messages" ADD COLUMN "reply_to_id" text;--> statement-breakpoint
ALTER TABLE "team_message_reactions" ADD CONSTRAINT "team_message_reactions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_msg_reaction_uq" ON "team_message_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "team_msg_reactions_msg_idx" ON "team_message_reactions" USING btree ("message_id");