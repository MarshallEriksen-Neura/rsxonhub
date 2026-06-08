ALTER TABLE "article_chunks" ADD COLUMN "title" text;
ALTER TABLE "article_chunks" ADD COLUMN "body" text;
ALTER TABLE "article_chunks" ADD COLUMN "chunk_type" text DEFAULT 'mixed' NOT NULL;
ALTER TABLE "article_chunks" ADD COLUMN "section_path" jsonb;
ALTER TABLE "article_chunks" ADD COLUMN "char_start" integer;
ALTER TABLE "article_chunks" ADD COLUMN "char_end" integer;
ALTER TABLE "article_chunks" ADD COLUMN "char_count" integer;
ALTER TABLE "article_chunks" ADD COLUMN "content_hash" text;

CREATE INDEX "article_chunks_article_content_hash_idx" ON "article_chunks" ("article_id", "content_hash");
