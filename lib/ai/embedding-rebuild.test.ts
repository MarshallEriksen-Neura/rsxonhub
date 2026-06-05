import { describe, expect, test } from "bun:test";
import { chunkArticleText, expectedEmbeddingDimension } from "@/lib/ai/embedding-text";
import { DEFAULT_EMBEDDING_DIM } from "@/lib/ai/defaults";

describe("embedding rebuild helpers", () => {
  test("chunks text deterministically with overlap", () => {
    const text = Array.from({ length: 260 }, (_, index) => `sentence-${index}.`).join(" ");
    const first = chunkArticleText(text);
    const second = chunkArticleText(text);

    expect(first.length).toBeGreaterThan(1);
    expect(second).toEqual(first);
    expect(first.every((chunk) => chunk.length <= 1200)).toBe(true);
  });

  test("uses schema embedding dimension as expected runtime dimension", () => {
    expect(expectedEmbeddingDimension()).toBe(DEFAULT_EMBEDDING_DIM);
  });
});

