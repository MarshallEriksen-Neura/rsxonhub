import { describe, expect, test } from "bun:test";
import { rankArticleCandidates } from "@/lib/retrieval/rank-candidates";

describe("hybrid candidate ranking", () => {
  test("keeps embedding-only candidates in the bounded candidate set", () => {
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const candidates = rankArticleCandidates({
      rows: [
        {
          articleId: 1,
          feedId: 10,
          title: "unrelated release notes",
          summaryRaw: "shipping details",
          content: "no lexical match here",
          publishedAt: old,
          fetchedAt: old,
          sourceMeta: null,
          weight: 1,
        },
        {
          articleId: 2,
          feedId: 10,
          title: "agent benchmark",
          summaryRaw: "agent retrieval result",
          content: null,
          publishedAt: old,
          fetchedAt: old,
          sourceMeta: null,
          weight: 1,
        },
      ],
      terms: ["agent"],
      profileVersion: 3,
      embeddingScores: new Map([[1, 0.92]]),
      maxCandidates: 10,
      perSourceLimit: 10,
    });

    expect(candidates.map((candidate) => candidate.articleId)).toContain(1);
    expect(candidates.find((candidate) => candidate.articleId === 1)?.embeddingScore).toBe(0.92);
  });

  test("enforces per-source caps after combining lexical and embedding signals", () => {
    const now = new Date();
    const candidates = rankArticleCandidates({
      rows: Array.from({ length: 4 }, (_, index) => ({
        articleId: index + 1,
        feedId: 20,
        title: `agent item ${index}`,
        summaryRaw: "agent",
        content: null,
        publishedAt: now,
        fetchedAt: now,
        sourceMeta: null,
        weight: 1,
      })),
      terms: ["agent"],
      profileVersion: 1,
      embeddingScores: new Map(),
      maxCandidates: 10,
      perSourceLimit: 2,
    });

    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) => candidate.feedId === 20)).toBe(true);
  });
});
