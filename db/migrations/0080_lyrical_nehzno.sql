ALTER TABLE "message_threads" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE INDEX "msg_threads_client_idx" ON "message_threads" USING btree ("client_id");