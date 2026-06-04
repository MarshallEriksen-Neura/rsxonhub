CREATE TABLE "article_relevance_scores" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"interest_profile_version" integer NOT NULL,
	"bm25_score" real,
	"embedding_score" real,
	"recency_score" real,
	"source_score" real,
	"combined_score" real NOT NULL,
	"features" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_candidates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"digest_date" text NOT NULL,
	"article_id" integer NOT NULL,
	"interest_profile_version" integer NOT NULL,
	"retrieval_rank" integer NOT NULL,
	"selection_stage" text NOT NULL,
	"score_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"digest_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"position" integer NOT NULL,
	"reason" text,
	"score_snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"digest_date" text NOT NULL,
	"interest_profile_version" integer NOT NULL,
	"title" text,
	"summary" text,
	"model" text,
	"token_cost" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_fetch_runs" (
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
CREATE TABLE "interest_profiles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(2048),
	"version" integer NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_summaries" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "article_summaries" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "article_summaries" ADD COLUMN "prompt_version" text;--> statement-breakpoint
ALTER TABLE "article_summaries" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "article_summaries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "source_meta" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "source_type" text DEFAULT 'http' NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "source_meta" jsonb;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_successful_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "etag" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_modified" text;--> statement-breakpoint
ALTER TABLE "article_relevance_scores" ADD CONSTRAINT "article_relevance_scores_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_candidates" ADD CONSTRAINT "digest_candidates_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_fetch_runs" ADD CONSTRAINT "feed_fetch_runs_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_relevance_article_profile_idx" ON "article_relevance_scores" USING btree ("article_id","interest_profile_version");--> statement-breakpoint
CREATE INDEX "article_relevance_combined_idx" ON "article_relevance_scores" USING btree ("combined_score");--> statement-breakpoint
CREATE UNIQUE INDEX "digest_candidates_date_article_idx" ON "digest_candidates" USING btree ("digest_date","article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "digest_items_digest_article_idx" ON "digest_items" USING btree ("digest_id","article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "digests_date_profile_idx" ON "digests" USING btree ("digest_date","interest_profile_version");--> statement-breakpoint
CREATE UNIQUE INDEX "interest_profiles_version_idx" ON "interest_profiles" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_feed_idx" ON "subscriptions" USING btree ("feed_id");