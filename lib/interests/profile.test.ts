import { beforeEach, describe, expect, mock, test } from "bun:test";

const embedMock = mock(async () => ({
  embedding: Array.from({ length: 4096 }, () => 0),
  usage: { tokens: 3 },
}));
const insertMock = mock(() => ({
  values: mock(),
}));
const selectMock = mock();

mock.module("ai", () => ({
  embed: embedMock,
}));

mock.module("@/lib/ai", () => ({
  embeddingModelWithConfig: mock(async () => ({
    config: { model: "bad-dimension-model" },
    model: "embedding-model",
  })),
  withAIRequestRetry: mock((operation: () => Promise<unknown>) => operation()),
}));

mock.module("@/lib/ai/embedding-rebuild", () => ({
  getEmbeddingVectorDimension: mock(async () => 2048),
}));

mock.module("@/lib/db", () => ({
  db: {
    select: selectMock,
    transaction: mock(),
    insert: insertMock,
  },
}));

mock.module("@/lib/db/schema", () => ({
  interestProfiles: {
    id: "id",
    content: "content",
    contentHash: "contentHash",
    embedding: "embedding",
    version: "version",
    isActive: "isActive",
  },
  usageLogs: {},
}));

mock.module("@/lib/rss/hash", () => ({
  stableHash: mock(() => "hash"),
}));

const { saveInterestProfile } = await import("./profile");

describe("saveInterestProfile", () => {
  beforeEach(() => {
    embedMock.mockClear();
    insertMock.mockClear();
    selectMock.mockClear();
    selectMock.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [],
          }),
        }),
      }),
    }));
  });

  test("rejects embedding dimensions that do not match the vector schema", async () => {
    await expect(saveInterestProfile("AI and NSFW")).rejects.toThrow(
      "向量模型维度为 4096,但当前数据库向量列需要 2048。",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });
});
