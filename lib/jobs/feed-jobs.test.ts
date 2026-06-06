import { afterEach, describe, expect, mock, test } from "bun:test";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/rsxonhub_test";

const sendMock = mock(async () => "job-id");
const workMock = mock(async () => undefined);
const dbSelectMock = mock();
const embedSingleArticleMock = mock(async () => undefined);
const rebuildArticleEmbeddingsMock = mock(async () => undefined);
const analyzeArticleMock = mock(async () => undefined);
const selectDigestCandidatesMock = mock(async () => []);
const getActiveInterestProfileMock = mock(async () => ({
  content: "agent retrieval",
  contentHash: "hash",
  version: 3,
  embedding: null,
}));
const hasCompletedDigestRunMock = mock(async () => false);
const createDigestRunMock = mock(async () => ({ id: 42 }));
const attachDigestRunJobMock = mock(async () => undefined);
const markDigestRunFinishedMock = mock(async () => undefined);
const markDigestRunRunningMock = mock(async () => undefined);
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
    work: workMock,
  }),
}));

mock.module("@/lib/db", () => ({
  db: {
    select: dbSelectMock,
  },
}));

mock.module("@/lib/db/schema", () => ({
  articleSummaries: {
    articleId: "article_id",
    status: "status",
  },
  digestItems: {},
  digestRuns: {},
  digests: {},
  feeds: {},
  interestProfiles: {},
  usageLogs: {},
}));

mock.module("@/lib/ai/article-analysis", () => ({
  analyzeArticle: analyzeArticleMock,
}));

mock.module("@/lib/ai/config", () => ({
  getChatConfig: mock(async () => ({
    kind: "chat" as const,
    baseUrl: "https://chat.example/v1",
    apiKey: "test-key",
    model: "chat-model",
    temperature: 0.4,
  })),
  getEmbeddingConfig: getEmbeddingConfigMock,
}));

mock.module("@/lib/ai/embedding-rebuild", () => ({
  embedSingleArticle: embedSingleArticleMock,
  rebuildArticleEmbeddings: rebuildArticleEmbeddingsMock,
}));

mock.module("@/lib/digest/generate-digest", () => ({
  generateDailyDigest: mock(),
}));

mock.module("@/lib/digest/runs", () => ({
  attachDigestRunJob: attachDigestRunJobMock,
  createDigestRun: createDigestRunMock,
  hasCompletedDigestRun: hasCompletedDigestRunMock,
  markDigestRunFinished: markDigestRunFinishedMock,
  markDigestRunRunning: markDigestRunRunningMock,
  normalizeRunError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

mock.module("@/lib/retrieval/hybrid-candidates", () => ({
  selectDigestCandidates: selectDigestCandidatesMock,
}));

mock.module("@/lib/interests/profile", () => ({
  getActiveInterestProfile: getActiveInterestProfileMock,
}));

mock.module("@/lib/rss/ingest", () => ({
  ingestFeed: mock(),
}));

describe("feed job post-ingest embedding enqueue", () => {
  afterEach(() => {
    sendMock.mockReset();
    sendMock.mockImplementation(async () => "job-id");
    workMock.mockReset();
    workMock.mockImplementation(async () => undefined);
    dbSelectMock.mockReset();
    embedSingleArticleMock.mockReset();
    embedSingleArticleMock.mockImplementation(async () => undefined);
    rebuildArticleEmbeddingsMock.mockReset();
    rebuildArticleEmbeddingsMock.mockImplementation(async () => undefined);
    selectDigestCandidatesMock.mockReset();
    selectDigestCandidatesMock.mockImplementation(async () => []);
    getActiveInterestProfileMock.mockReset();
    getActiveInterestProfileMock.mockImplementation(async () => ({
      content: "agent retrieval",
      contentHash: "hash",
      version: 3,
      embedding: null,
    }));
    hasCompletedDigestRunMock.mockReset();
    hasCompletedDigestRunMock.mockImplementation(async () => false);
    createDigestRunMock.mockReset();
    createDigestRunMock.mockImplementation(async () => ({ id: 42 }));
    attachDigestRunJobMock.mockReset();
    attachDigestRunJobMock.mockImplementation(async () => undefined);
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

  test("gives full rebuild embedding jobs a longer expiration budget", async () => {
    const { JOB_NAMES } = await import("@/lib/jobs/names");
    const { enqueueArticleEmbedding } = await import("@/lib/jobs/feed-jobs");

    await enqueueArticleEmbedding({ rebuildRunId: 7 });

    expect(sendMock).toHaveBeenCalledWith(
      JOB_NAMES.articleEmbed,
      { rebuildRunId: 7 },
      expect.objectContaining({
        expireInSeconds: 60 * 60 * 2,
        retryBackoff: true,
        retryDelayMax: 60 * 10,
        singletonKey: "embedding.rebuild:7",
      }),
    );
  });
});

describe("feed job candidate analysis closure", () => {
  afterEach(() => {
    sendMock.mockReset();
    sendMock.mockImplementation(async () => "job-id");
    dbSelectMock.mockReset();
    analyzeArticleMock.mockReset();
    analyzeArticleMock.mockImplementation(async () => undefined);
    selectDigestCandidatesMock.mockReset();
    selectDigestCandidatesMock.mockImplementation(async () => []);
    getActiveInterestProfileMock.mockReset();
    getActiveInterestProfileMock.mockImplementation(async () => ({
      content: "agent retrieval",
      contentHash: "hash",
      version: 3,
      embedding: null,
    }));
    hasCompletedDigestRunMock.mockReset();
    hasCompletedDigestRunMock.mockImplementation(async () => false);
    createDigestRunMock.mockReset();
    createDigestRunMock.mockImplementation(async () => ({ id: 42 }));
    attachDigestRunJobMock.mockReset();
    attachDigestRunJobMock.mockImplementation(async () => undefined);
  });

  test("runs analysis immediately for retrieved candidate articles", async () => {
    const { analyzeCurrentCandidates } = await import("@/lib/jobs/feed-jobs");

    const analyzed = await analyzeCurrentCandidates([
      { articleId: 11 },
      { articleId: 12 },
      { articleId: 13 },
    ] as Awaited<ReturnType<typeof selectDigestCandidatesMock>>);

    expect(analyzed).toBe(3);
    expect(analyzeArticleMock.mock.calls.map((call) => call[0])).toEqual([11, 12, 13]);
    expect(sendMock).not.toHaveBeenCalled();
    expect(selectDigestCandidatesMock).not.toHaveBeenCalled();
  });
});

describe("feed job embedding-to-preparation closure", () => {
  afterEach(() => {
    sendMock.mockReset();
    sendMock.mockImplementation(async () => "job-id");
    workMock.mockReset();
    workMock.mockImplementation(async () => undefined);
    embedSingleArticleMock.mockReset();
    embedSingleArticleMock.mockImplementation(async () => undefined);
    rebuildArticleEmbeddingsMock.mockReset();
    rebuildArticleEmbeddingsMock.mockImplementation(async () => undefined);
    hasCompletedDigestRunMock.mockReset();
    hasCompletedDigestRunMock.mockImplementation(async () => false);
    createDigestRunMock.mockReset();
    createDigestRunMock.mockImplementation(async () => ({ id: 42 }));
    attachDigestRunJobMock.mockReset();
    attachDigestRunJobMock.mockImplementation(async () => undefined);
  });

  test("enqueues digest preparation after changed article embedding completes", async () => {
    const { JOB_NAMES } = await import("@/lib/jobs/names");
    const { registerFeedJobs } = await import("@/lib/jobs/feed-jobs");

    await registerFeedJobs();
    const articleEmbedRegistration = workMock.mock.calls.find(
      (call) => call[0] === JOB_NAMES.articleEmbed,
    );
    expect(articleEmbedRegistration).toBeTruthy();

    const handler = articleEmbedRegistration?.[1] as (
      jobs: { data: { articleId: number } }[],
    ) => Promise<void>;
    await handler([{ data: { articleId: 21 } }]);

    expect(embedSingleArticleMock).toHaveBeenCalledWith(21);
    expect(sendMock.mock.calls.some((call) => call[0] === JOB_NAMES.digestPrepareDaily)).toBe(
      true,
    );
  });

  test("does not enqueue digest preparation for full embedding rebuild jobs", async () => {
    const { JOB_NAMES } = await import("@/lib/jobs/names");
    const { registerFeedJobs } = await import("@/lib/jobs/feed-jobs");

    await registerFeedJobs();
    const articleEmbedRegistration = workMock.mock.calls.find(
      (call) => call[0] === JOB_NAMES.articleEmbed,
    );
    const handler = articleEmbedRegistration?.[1] as (
      jobs: { data: { rebuildRunId: number } }[],
    ) => Promise<void>;
    await handler([{ data: { rebuildRunId: 7 } }]);

    expect(rebuildArticleEmbeddingsMock).toHaveBeenCalledWith(7);
    expect(sendMock.mock.calls.some((call) => call[0] === JOB_NAMES.digestPrepareDaily)).toBe(
      false,
    );
  });
});
