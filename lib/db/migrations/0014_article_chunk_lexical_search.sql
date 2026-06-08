CREATE INDEX "article_chunks_body_fts_idx"
ON "article_chunks"
USING gin (to_tsvector('simple', coalesce("body", "content", '')));

CREATE INDEX "articles_title_summary_fts_idx"
ON "articles"
USING gin ((
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("summary_raw", '')), 'B')
));
