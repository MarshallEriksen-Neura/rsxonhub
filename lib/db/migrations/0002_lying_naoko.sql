CREATE TABLE "embedding_rebuild_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"model" text NOT NULL,
	"base_url" text NOT NULL,
	"dimension" integer NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
