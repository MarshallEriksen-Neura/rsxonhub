import { z } from "zod";

export const DAILY_DIGEST_PROMPT_VERSION = "daily-digest-v1";
export const DAILY_DIGEST_SCHEMA_NAME = "DailyDigest";
export const DAILY_DIGEST_SCHEMA_DESCRIPTION =
  "A daily RSS digest object with title, summary, and selected article items.";

export const digestSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  items: z
    .array(
      z.object({
        articleId: z.number().int().positive(),
        reason: z.string().min(1).max(360),
      }),
    )
    .min(1)
    .max(12),
});

const legacySelectionSchema = z.object({
  selectedArticles: z
    .array(
      z.object({
        articleId: z.number().int().positive(),
        title: z.string().optional(),
        reason: z.string().min(1).max(360),
      }),
    )
    .min(1),
});

export type DailyDigestCandidateForPrompt = {
  articleId: number;
  title: string | null;
  source: string | null;
  publishedAt: string | null;
  summary: string | null;
  retrievalRank: number;
  scoreSnapshot: unknown;
};

export function buildDailyDigestPrompt({
  digestDate,
  interestProfile,
  candidates,
}: {
  digestDate: string;
  interestProfile: string;
  candidates: DailyDigestCandidateForPrompt[];
}) {
  return JSON.stringify(
    {
      promptVersion: DAILY_DIGEST_PROMPT_VERSION,
      task: "Write the final daily digest, not only the article selection.",
      outputContract: {
        requiredTopLevelKeys: ["title", "summary", "items"],
        forbiddenTopLevelKeys: ["selectedArticles"],
        itemShape: {
          articleId: "number from candidates[].articleId",
          reason: "string explaining why this article belongs in the digest",
        },
      },
      digestDate,
      interestProfile,
      candidates,
    },
    null,
    2,
  );
}

export async function repairDailyDigestText(
  text: string,
  candidates: DailyDigestCandidateForPrompt[],
) {
  const value = parseJsonObject(text);
  if (!value) return null;

  const legacy = legacySelectionSchema.safeParse(value);
  if (!legacy.success) return null;

  const candidatesById = new Map(candidates.map((candidate) => [candidate.articleId, candidate]));
  const selected = legacy.data.selectedArticles
    .filter((item) => candidatesById.has(item.articleId))
    .slice(0, 12);
  if (selected.length === 0) return null;

  const title = buildDigestTitle(selected, candidatesById);
  const summary = buildDigestSummary(selected, candidatesById);
  const repaired = {
    title,
    summary,
    items: selected.map((item) => ({
      articleId: item.articleId,
      reason: item.reason,
    })),
  };

  return digestSchema.safeParse(repaired).success ? JSON.stringify(repaired) : null;
}

function parseJsonObject(text: string) {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : null;
  } catch {
    return null;
  }
}

function buildDigestTitle(
  selected: Array<{ articleId: number; title?: string }>,
  candidatesById: Map<number, DailyDigestCandidateForPrompt>,
) {
  const leadingTopics = selected
    .map((item) => item.title ?? candidatesById.get(item.articleId)?.title)
    .filter((title): title is string => Boolean(title?.trim()))
    .slice(0, 2);

  return truncateText(
    leadingTopics.length > 0 ? `Daily digest: ${leadingTopics.join(" / ")}` : "Daily digest",
    160,
  );
}

function buildDigestSummary(
  selected: Array<{ articleId: number; reason: string; title?: string }>,
  candidatesById: Map<number, DailyDigestCandidateForPrompt>,
) {
  const summary = selected
    .map((item) => {
      const title = item.title ?? candidatesById.get(item.articleId)?.title ?? `Article ${item.articleId}`;
      return `${title}: ${item.reason}`;
    })
    .join("\n");

  return truncateText(summary, 1200);
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
