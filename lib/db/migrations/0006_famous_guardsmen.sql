CREATE TABLE "app_error_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"operation" text NOT NULL,
	"severity" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"error_name" text,
	"stack" text,
	"details" jsonb,
	"feed_id" integer,
	"feed_fetch_run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_error_logs" ADD CONSTRAINT "app_error_logs_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_error_logs" ADD CONSTRAINT "app_error_logs_feed_fetch_run_id_feed_fetch_runs_id_fk" FOREIGN KEY ("feed_fetch_run_id") REFERENCES "public"."feed_fetch_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_error_logs_created_idx" ON "app_error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_error_logs_source_operation_idx" ON "app_error_logs" USING btree ("source","operation");--> statement-breakpoint
CREATE INDEX "app_error_logs_feed_idx" ON "app_error_logs" USING btree ("feed_id");
