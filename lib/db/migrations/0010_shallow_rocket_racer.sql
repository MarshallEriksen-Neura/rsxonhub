CREATE TABLE IF NOT EXISTS "embedding_rebuild_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"model" text NOT NULL,
	"base_url" text NOT NULL,
	"dimension" integer NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"job_id" text,
	"total_article_count" integer DEFAULT 0 NOT NULL,
	"last_processed_article_id" integer DEFAULT 0 NOT NULL,
	"last_processed_at" timestamp with time zone,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embedding_rebuild_runs" ADD COLUMN IF NOT EXISTS "job_id" text;
--> statement-breakpoint
ALTER TABLE "embedding_rebuild_runs" ADD COLUMN IF NOT EXISTS "total_article_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "embedding_rebuild_runs" ADD COLUMN IF NOT EXISTS "last_processed_article_id" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "embedding_rebuild_runs" ADD COLUMN IF NOT EXISTS "last_processed_at" timestamp with time zone;
