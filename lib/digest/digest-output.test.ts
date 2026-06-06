import { describe, expect, test } from "bun:test";
import {
  buildDailyDigestPrompt,
  digestSchema,
  repairDailyDigestText,
  type DailyDigestCandidateForPrompt,
} from "@/lib/digest/digest-output";

const candidates: DailyDigestCandidateForPrompt[] = [
  {
    articleId: 7587,
    title: "Agent-Orchestrated Adaptive RAG",
    source: "arXiv",
    publishedAt: "2026-06-06T00:00:00.000Z",
    summary: "Adaptive RAG study.",
    retrievalRank: 1,
    scoreSnapshot: { combinedScore: 0.91 },
  },
  {
    articleId: 7623,
    title: "Graph-based Retrieval-Augmented Generation",
    source: "arXiv",
    publishedAt: "2026-06-05T00:00:00.000Z",
    summary: "Graph retrieval for hallucination reduction.",
    retrievalRank: 2,
    scoreSnapshot: { combinedScore: 0.88 },
  },
];

describe("daily digest output contract", () => {
  test("prompts for final digest fields instead of stale selection fields", () => {
    const prompt = JSON.parse(
      buildDailyDigestPrompt({
        digestDate: "2026-06-06",
        interestProfile: "AI Agent and RAG",
        candidates,
      }),
    );

    expect(prompt.outputContract.requiredTopLevelKeys).toEqual(["title", "summary", "items"]);
    expect(prompt.outputContract.forbiddenTopLevelKeys).toContain("selectedArticles");
    expect(prompt.candidates).toHaveLength(2);
  });

  test("rejects stale selectedArticles output as the canonical digest object", () => {
    const staleOutput = {
      selectedArticles: [
        {
          articleId: 7587,
          title: "Agent-Orchestrated Adaptive RAG",
          reason: "Matches the AI Agent and RAG profile.",
        },
      ],
    };

    expect(digestSchema.safeParse(staleOutput).success).toBe(false);
  });

  test("repairs stale selectedArticles output into the digest schema", async () => {
    const staleText = JSON.stringify({
      selectedArticles: [
        {
          articleId: 7587,
          title: "Agent-Orchestrated Adaptive RAG",
          reason: "Matches the AI Agent and RAG profile.",
        },
        {
          articleId: 999999,
          title: "Not a candidate",
          reason: "This should be filtered out.",
        },
      ],
    });

    const repairedText = await repairDailyDigestText(staleText, candidates);
    expect(repairedText).not.toBeNull();

    const parsed = digestSchema.parse(JSON.parse(repairedText ?? ""));
    expect(parsed.title).toContain("Agent-Orchestrated Adaptive RAG");
    expect(parsed.items).toEqual([
      {
        articleId: 7587,
        reason: "Matches the AI Agent and RAG profile.",
      },
    ]);
  });
});
