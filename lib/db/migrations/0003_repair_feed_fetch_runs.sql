CREATE TABLE IF NOT EXISTS "feed_fetch_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_fetch_runs" ADD CONSTRAINT "feed_fetch_runs_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
