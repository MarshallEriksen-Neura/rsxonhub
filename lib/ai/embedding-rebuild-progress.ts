export type EmbeddingRebuildProgress = {
  articleCount: number;
  chunkCount: number;
  lastProcessedArticleId: number;
};

export function advanceEmbeddingRebuildProgress(
  progress: EmbeddingRebuildProgress,
  input: { articleId: number; chunkCount: number },
): EmbeddingRebuildProgress {
  return {
    articleCount: progress.articleCount + 1,
    chunkCount: progress.chunkCount + input.chunkCount,
    lastProcessedArticleId: input.articleId,
  };
}
