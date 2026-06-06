export type EmbeddingRebuildStatus = "pending" | "running" | "complete" | "failed";

export type EmbeddingRebuildRunLike = {
  id: number;
  status: EmbeddingRebuildStatus;
  model: string;
  baseUrl: string;
  dimension: number;
  articleCount: number;
  chunkCount: number;
  jobId: string | null;
  totalArticleCount: number;
  lastProcessedArticleId: number;
  lastProcessedAt: Date | null;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export type EmbeddingRebuildEvent = {
  id: number;
  status: EmbeddingRebuildStatus;
  model: string;
  baseUrl: string;
  dimension: number;
  articleCount: number;
  chunkCount: number;
  jobId: string | null;
  totalArticleCount: number;
  lastProcessedArticleId: number;
  lastProcessedAt: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  percent: number | null;
  terminal: boolean;
};

export function serializeEmbeddingRebuildRun(
  run: EmbeddingRebuildRunLike,
): EmbeddingRebuildEvent {
  return {
    id: run.id,
    status: run.status,
    model: run.model,
    baseUrl: run.baseUrl,
    dimension: run.dimension,
    articleCount: run.articleCount,
    chunkCount: run.chunkCount,
    jobId: run.jobId,
    totalArticleCount: run.totalArticleCount,
    lastProcessedArticleId: run.lastProcessedArticleId,
    lastProcessedAt: run.lastProcessedAt?.toISOString() ?? null,
    error: run.error,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    percent: rebuildPercent(run.articleCount, run.totalArticleCount),
    terminal: isTerminalEmbeddingRebuildStatus(run.status),
  };
}

export function isTerminalEmbeddingRebuildStatus(status: EmbeddingRebuildStatus) {
  return status === "complete" || status === "failed";
}

export function rebuildPercent(articleCount: number, totalArticleCount: number) {
  if (totalArticleCount <= 0) return null;
  return Math.min(100, Math.round((articleCount / totalArticleCount) * 100));
}
