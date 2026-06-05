import { afterEach, describe, expect, mock, test } from "bun:test";

const sendMock = mock(async () => "job-id");
const getEmbeddingConfigMock = mock(async () => ({
  kind: "embedding" as const,
  baseUrl: "https://embedding.example/v1",
  apiKey: "test-key",
  model: "embedding-model",
  dimension: 2048,
}));

mock.module("@/lib/jobs/boss", () => ({
  startBoss: async () => ({
    send: sendMock,
  }),
}));

mock.module("@/lib/db", () => ({
  db: {
    select: mock(),
  },
}));

mock.module("@/lib/db/schema", () => ({
  articleSummaries: {},
  feeds: {},
}));

mock.module("@/lib/ai/article-analysis", () => ({
  analyzeArticle: mock(),
}));

mock.module("@/lib/ai/config", () => ({
  getEmbeddingConfig: getEmbeddingConfigMock,
}));

mock.module("@/lib/ai/embedding-rebuild", () => ({
  embedSingleArticle: mock(),
  rebuildArticleEmbeddings: mock(),
}));

mock.module("@/lib/digest/generate-digest", () => ({
  generateDailyDigest: mock(),
}));

mock.module("@/lib/retrieval/hybrid-candidates", () => ({
  selectDigestCandidates: mock(async () => []),
}));

mock.module("@/lib/rss/ingest", () => ({
  ingestFeed: mock(),
}));

describe("feed job post-ingest embedding enqueue", () => {
  afterEach(() => {
    sendMock.mockReset();
    sendMock.mockImplementation(async () => "job-id");
    getEmbeddingConfigMock.mockReset();
    getEmbeddingConfigMock.mockImplementation(async () => ({
      kind: "embedding" as const,
      baseUrl: "https://embedding.example/v1",
      apiKey: "test-key",
      model: "embedding-model",
      dimension: 2048,
    }));
  });

  test("enqueues one article embedding job per changed article", async () => {
    const { JOB_NAMES } = await import("@/lib/jobs/names");
    const { enqueueChangedArticleEmbeddings } = await import("@/lib/jobs/feed-jobs");

    const result = await enqueueChangedArticleEmbeddings({
      changedArticleIds: [11, 12, 11],
    });

    expect(result).toEqual({ enqueuedCount: 2, skipped: false, error: null });
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0]).toBe(JOB_NAMES.articleEmbed);
    expect(sendMock.mock.calls.map((call) => call[1])).toEqual([
      { articleId: 11 },
      { articleId: 12 },
    ]);
  });

  test("skips enqueue when ingest did not change articles", async () => {
    const { enqueueChangedArticleEmbeddings } = await import("@/lib/jobs/feed-jobs");

    const result = await enqueueChangedArticleEmbeddings({ changedArticleIds: [] });

    expect(result).toEqual({ enqueuedCount: 0, skipped: true, error: null });
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("reports enqueue failure without failing the ingest path", async () => {
    sendMock.mockImplementation(async () => {
      throw new Error("pg-boss unavailable");
    });
    const { enqueueChangedArticleEmbeddings } = await import("@/lib/jobs/feed-jobs");

    const result = await enqueueChangedArticleEmbeddings({ changedArticleIds: [11] });

    expect(result).toEqual({
      enqueuedCount: 0,
      skipped: false,
      error: "pg-boss unavailable",
    });
  });

  test("skips enqueue when embedding api key is not configured", async () => {
    getEmbeddingConfigMock.mockImplementation(async () => ({
      kind: "embedding" as const,
      baseUrl: "https://embedding.example/v1",
      apiKey: "",
      model: "embedding-model",
      dimension: 2048,
    }));
    const { enqueueChangedArticleEmbeddings } = await import("@/lib/jobs/feed-jobs");

    const result = await enqueueChangedArticleEmbeddings({ changedArticleIds: [11] });

    expect(result).toEqual({
      enqueuedCount: 0,
      skipped: true,
      error: "向量模型 API Key 未配置,已跳过后台 RAG 索引。",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
