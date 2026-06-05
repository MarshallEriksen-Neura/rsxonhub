import { generateObject } from "ai";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { chatModel, withAIRequestRetry } from "@/lib/ai";
import { getChatConfig } from "@/lib/ai/config";
import { db } from "@/lib/db";
import {
  articleSummaries,
  articles,
  digestCandidates,
  digestItems,
  digests,
  feeds,
  interestProfiles,
  usageLogs,
} from "@/lib/db/schema";
import { selectDigestCandidates } from "@/lib/retrieval/hybrid-candidates";

export const DAILY_DIGEST_PROMPT_VERSION = "daily-digest-v1";

const digestSchema = z.object({
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

export type GenerateDailyDigestInput = {
  digestDate?: string;
  maxCandidates?: number;
};

export async function generateDailyDigest(input: GenerateDailyDigestInput = {}) {
  const digestDate = input.digestDate ?? todayKey();
  let candidates = await getPersistedCandidates(digestDate);

  if (candidates.length === 0) {
    await selectDigestCandidates({ digestDate, maxCandidates: input.maxCandidates });
    candidates = await getPersistedCandidates(digestDate);
  }

  if (candidates.length === 0) {
    return { skipped: true as const, reason: "no_candidates" };
  }

  const profile = candidates[0].interestProfile;
  const config = await getChatConfig();
  const model = await chatModel();
  const result = await withAIRequestRetry(() =>
    generateObject({
      model,
      schema: digestSchema,
      temperature: 0.4,
      system:
        "你是单用户 RSS x AI 阅读器的每日简报编辑。只能从候选文章中选择，理由必须基于用户兴趣画像和候选证据。不要引入外部事实。",
      prompt: JSON.stringify(
        {
          promptVersion: DAILY_DIGEST_PROMPT_VERSION,
          digestDate,
          interestProfile: profile.content,
          candidates: candidates.map((candidate) => ({
            articleId: candidate.articleId,
            title: candidate.title,
            source: candidate.feedTitle,
            publishedAt: candidate.publishedAt?.toISOString() ?? null,
            summary: candidate.aiSummary ?? candidate.summaryRaw,
            retrievalRank: candidate.retrievalRank,
            scoreSnapshot: candidate.scoreSnapshot,
          })),
        },
        null,
        2,
      ),
    }),
  );

  const allowedIds = new Set(candidates.map((candidate) => candidate.articleId));
  const selected = result.object.items.filter((item) => allowedIds.has(item.articleId));
  if (selected.length === 0) {
    throw new Error("Daily digest model did not select any candidate article.");
  }

  const tokenCost = result.usage
    ? (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0)
    : null;

  const digest = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(digests)
      .values({
        digestDate,
        interestProfileVersion: profile.version,
        title: result.object.title,
        summary: result.object.summary,
        model: config.model,
        tokenCost,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [digests.digestDate, digests.interestProfileVersion],
        set: {
          title: result.object.title,
          summary: result.object.summary,
          model: config.model,
          tokenCost,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    await tx.delete(digestItems).where(eq(digestItems.digestId, row.id));

    for (const [index, item] of selected.entries()) {
      const candidate = candidates.find((entry) => entry.articleId === item.articleId);
      await tx.insert(digestItems).values({
        digestId: row.id,
        articleId: item.articleId,
        position: index + 1,
        reason: item.reason,
        scoreSnapshot: candidate?.scoreSnapshot ?? null,
      });
    }

    return row;
  });

  await db.insert(usageLogs).values({
    kind: "digest",
    model: config.model,
    tokens: tokenCost,
    cost: null,
  });

  return { skipped: false as const, digestId: digest.id, selectedCount: selected.length };
}

export async function getDailyDigest(digestDate = todayKey()) {
  const [digest] = await db
    .select()
    .from(digests)
    .where(eq(digests.digestDate, digestDate))
    .orderBy(asc(digests.id))
    .limit(1);

  if (!digest) {
    return null;
  }

  const items = await db
    .select({
      position: digestItems.position,
      reason: digestItems.reason,
      scoreSnapshot: digestItems.scoreSnapshot,
      articleId: articles.id,
      title: articles.title,
      url: articles.url,
      feedTitle: feeds.title,
      publishedAt: articles.publishedAt,
      summaryRaw: articles.summaryRaw,
      aiSummary: articleSummaries.summary,
      tags: articleSummaries.tags,
      importance: articleSummaries.importance,
    })
    .from(digestItems)
    .innerJoin(articles, eq(articles.id, digestItems.articleId))
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
    .where(eq(digestItems.digestId, digest.id))
    .orderBy(asc(digestItems.position));

  return { digest, items };
}

async function getPersistedCandidates(digestDate: string) {
  return db
    .select({
      articleId: articles.id,
      title: articles.title,
      url: articles.url,
      publishedAt: articles.publishedAt,
      summaryRaw: articles.summaryRaw,
      aiSummary: articleSummaries.summary,
      feedTitle: feeds.title,
      retrievalRank: digestCandidates.retrievalRank,
      scoreSnapshot: digestCandidates.scoreSnapshot,
      interestProfile: {
        content: interestProfiles.content,
        version: interestProfiles.version,
      },
    })
    .from(digestCandidates)
    .innerJoin(articles, eq(articles.id, digestCandidates.articleId))
    .innerJoin(feeds, eq(feeds.id, articles.feedId))
    .innerJoin(
      interestProfiles,
      and(
        eq(interestProfiles.version, digestCandidates.interestProfileVersion),
        eq(interestProfiles.isActive, 1),
      ),
    )
    .leftJoin(articleSummaries, eq(articleSummaries.articleId, articles.id))
    .where(eq(digestCandidates.digestDate, digestDate))
    .orderBy(asc(digestCandidates.retrievalRank));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
