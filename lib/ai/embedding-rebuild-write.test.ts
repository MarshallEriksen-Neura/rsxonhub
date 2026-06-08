import { beforeEach, describe, expect, mock, test } from "bun:test";

const embedManyMock = mock(async ({ values }: { values: string[] }) => ({
  embeddings: values.map(() => [0.1, 0.2, 0.3]),
  usage: { tokens: values.length },
}));
const deleteCalls: unknown[] = [];
const upsertValues: Record<string, unknown>[] = [];
const dbDeleteMock = mock((table: unknown) => {
  deleteCalls.push({ table });
  return {
    where: mock(async (condition: unknown) => {
      deleteCalls.push({ condition });
    }),
  };
});
const dbInsertMock = mock(() => ({
  values: mock(async () => undefined),
}));
const txInsertMock = mock(() => ({
  values: mock((value: Record<string, unknown>) => {
    upsertValues.push(value);
    return {
      onConflictDoUpdate: mock(async () => undefined),
    };
  }),
}));

mock.module("ai", () => ({
  embedMany: embedManyMock,
  embed: mock(),
}));

mock.module("@/lib/ai", () => ({
  embeddingModelWithConfig: mock(async () => ({
    config: { model: "embedding-model" },
    model: "embedding-model",
  })),
  withAIRequestRetry: mock((operation: () => Promise<unknown>) => operation()),
}));

mock.module("@/lib/ai/config", () => ({
  getEmbeddingConfig: mock(async () => ({
    kind: "embedding",
    baseUrl: "https://embedding.example/v1",
    model: "embedding-model",
    dimension: 3,
  })),
}));

mock.module("@/lib/db", () => ({
  db: {
    delete: dbDeleteMock,
    insert: dbInsertMock,
    transaction: mock(async (callback: (tx: { insert: typeof txInsertMock }) => Promise<void>) =>
      callback({ insert: txInsertMock }),
    ),
  },
}));

mock.module("@/lib/db/schema", () => ({
  articleChunks: {
    articleId: "article_id",
    chunkIndex: "chunk_index",
    content: "content",
    embedding: "embedding",
    title: "title",
    body: "body",
    chunkType: "chunk_type",
    sectionPath: "section_path",
    charStart: "char_start",
    charEnd: "char_end",
    charCount: "char_count",
    contentHash: "content_hash",
  },
  articles: {},
  embeddingRebuildRuns: {},
  interestProfiles: {},
  usageLogs: {},
}));

const { __testEmbedArticle, __testFuseHybridChunkCandidates } = await import(
  "@/lib/ai/embedding-rebuild"
);

describe("embedding rebuild write path", () => {
  beforeEach(() => {
    embedManyMock.mockClear();
    dbDeleteMock.mockClear();
    dbInsertMock.mockClear();
    txInsertMock.mockClear();
    deleteCalls.length = 0;
    upsertValues.length = 0;
  });

  test("stores chunk metadata and deletes stale higher-index chunks", async () => {
    const text = Array.from(
      { length: 12 },
      (_, index) => `<h2>Section ${index}</h2><p>${"body ".repeat(120)}</p>`,
    ).join("");

    const result = await __testEmbedArticle(42, text, "Article Title");

    expect(result.chunkCount).toBeGreaterThan(1);
    expect(upsertValues.length).toBe(result.chunkCount);
    expect(upsertValues[0]).toMatchObject({
      articleId: 42,
      chunkIndex: 0,
      title: "Article Title",
      chunkType: "mixed",
    });
    expect(upsertValues[0].body).toBeString();
    expect(upsertValues[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(dbDeleteMock).toHaveBeenCalledTimes(1);
    expect(deleteCalls.length).toBeGreaterThan(1);
  });

  test("fuses vector and lexical candidates while preserving lexical-only matches", () => {
    const base = {
      content: "content",
      body: "body",
      title: "title",
      chunkType: "paragraph",
      sectionPath: [],
      charStart: 0,
      charEnd: 4,
      charCount: 4,
      contentHash: "hash",
    };

    const rows = __testFuseHybridChunkCandidates(
      [
        { ...base, articleId: 1, chunkIndex: 0, distance: 0.1 },
        { ...base, articleId: 2, chunkIndex: 0, distance: 0.2 },
      ],
      [
        { ...base, articleId: 2, chunkIndex: 0, distance: null, lexicalScore: 3 },
        { ...base, articleId: 3, chunkIndex: 0, distance: null, lexicalScore: 2 },
      ],
    );

    expect(rows.map((row) => [row.articleId, row.retrievalSource])).toEqual([
      [2, "hybrid"],
      [1, "vector"],
      [3, "lexical"],
    ]);
    expect(rows[0].vectorRank).toBe(2);
    expect(rows[0].lexicalRank).toBe(1);
    expect(rows[2].distance).toBeNull();
  });
});
