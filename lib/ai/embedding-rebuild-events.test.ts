import { describe, expect, test } from "bun:test";
import {
  isTerminalEmbeddingRebuildStatus,
  rebuildPercent,
  serializeEmbeddingRebuildRun,
  type EmbeddingRebuildRunLike,
} from "@/lib/ai/embedding-rebuild-events";

describe("embedding rebuild events", () => {
  test("serializes run progress for SSE clients", () => {
    const createdAt = new Date("2026-06-06T10:00:00.000Z");
    const lastProcessedAt = new Date("2026-06-06T10:01:00.000Z");
    const run: EmbeddingRebuildRunLike = {
      id: 42,
      status: "running",
      model: "embedder",
      baseUrl: "https://example.test/v1",
      dimension: 2048,
      articleCount: 3,
      chunkCount: 21,
      jobId: "job-1",
      totalArticleCount: 10,
      lastProcessedArticleId: 99,
      lastProcessedAt,
      error: null,
      startedAt: createdAt,
      finishedAt: null,
      createdAt,
    };

    expect(serializeEmbeddingRebuildRun(run)).toEqual({
      id: 42,
      status: "running",
      model: "embedder",
      baseUrl: "https://example.test/v1",
      dimension: 2048,
      articleCount: 3,
      chunkCount: 21,
      jobId: "job-1",
      totalArticleCount: 10,
      lastProcessedArticleId: 99,
      lastProcessedAt: "2026-06-06T10:01:00.000Z",
      error: null,
      startedAt: "2026-06-06T10:00:00.000Z",
      finishedAt: null,
      createdAt: "2026-06-06T10:00:00.000Z",
      percent: 30,
      terminal: false,
    });
  });

  test("marks only complete and failed statuses as terminal", () => {
    expect(isTerminalEmbeddingRebuildStatus("pending")).toBe(false);
    expect(isTerminalEmbeddingRebuildStatus("running")).toBe(false);
    expect(isTerminalEmbeddingRebuildStatus("complete")).toBe(true);
    expect(isTerminalEmbeddingRebuildStatus("failed")).toBe(true);
  });

  test("caps progress percentage and keeps unknown totals explicit", () => {
    expect(rebuildPercent(11, 10)).toBe(100);
    expect(rebuildPercent(0, 0)).toBeNull();
  });
});
