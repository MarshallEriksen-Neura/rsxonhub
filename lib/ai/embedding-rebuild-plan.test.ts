import { describe, expect, test } from "bun:test";
import { planEmbeddingRebuild } from "./embedding-rebuild-plan";

describe("embedding rebuild planning", () => {
  test("asks for confirmation before resizing vector columns", () => {
    const plan = planEmbeddingRebuild({
      embeddingChanged: true,
      existingChunkCount: 0,
      probedDimension: 4096,
      expectedDimension: 2048,
      confirmed: false,
    });

    expect(plan).toEqual({
      action: "confirm",
      message:
        "新向量模型维度与当前数据库向量列不同。确认后会更新向量列维度、清除旧向量,并在后台重建文章向量。",
      existingChunkCount: 0,
      probedDimension: 4096,
      expectedDimension: 2048,
    });
  });

  test("resizes vector columns after the user confirms rebuild", () => {
    expect(
      planEmbeddingRebuild({
        embeddingChanged: true,
        existingChunkCount: 12,
        probedDimension: 4096,
        expectedDimension: 2048,
        confirmed: true,
      }),
    ).toEqual({
      action: "rebuild",
      resizeDimension: 4096,
    });
  });
});
