ALTER TABLE "invoices" ADD COLUMN "appointment_id" text;--> statement-breakpoint
CREATE INDEX "invoice_appt_idx" ON "invoices" USING btree ("appointment_id");