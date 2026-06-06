import { generateObject } from "ai";
import { and, asc, eq, sql } from "drizzle-orm";
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
import {
  DAILY_DIGEST_SCHEMA_DESCRIPTION,
  DAILY_DIGEST_SCHEMA_NAME,
  buildDailyDigestPrompt,
  digestSchema,
  repairDailyDigestText,
} from "@/lib/digest/digest-output";
import {
  createDigestRun,
  hasCompletedDigestRun,
  markDigestRunFinished,
  markDigestRunRunning,
  normalizeRunError,
} from "@/lib/digest/runs";
import { getScheduleLocalDate } from "@/lib/datetime";
import { env } from "@/lib/env";
import { getActiveInterestProfile } from "@/lib/interests/profile";
import { selectDigestCandidates } from "@/lib/retrieval/hybrid-candidates";

export type GenerateDailyDigestInput = {
  digestDate?: string;
  interestProfileVersion?: number;
  runId?: number;
  maxCandidates?: number;
};

export async function generateDailyDigest(input: GenerateDailyDigestInput = {}) {
  const digestDate = input.digestDate ?? getScheduleLocalDate(env.DIGEST_TIMEZONE);
  const activeProfile = await getActiveInterestProfile();
  const run =
    input.runId != null
      ? { id: input.runId }
      : activeProfile
        ? await createDigestRun({
            digestDate,
            interestProfileVersion: activeProfile.version,
            phase: "generate",
            status: "running",
          })
        : null;

  if (input.runId != null) {
    await markDigestRunRunning(input.runId);
  }

  try {
    if (!activeProfile) {
      if (run) {
        await markDigestRunFinished(run.id, {
          status: "skipped",
          error: "no_interest_profile",
        });
      } else {
        const alreadySkipped = await hasCompletedDigestRun({
          digestDate,
          interestProfileVersion: 0,
          phase: "generate",
          statuses: ["skipped"],
        });
        if (!alreadySkipped) {
          await createDigestRun({
            digestDate,
            interestProfileVersion: 0,
            phase: "generate",
            status: "skipped",
            error: "no_interest_profile",
          });
        }
      }
      return { skipped: true as const, reason: "no_interest_profile" };
    }

    const result = await generateDailyDigestForProfile({
      ...input,
      digestDate,
      interestProfileVersion: activeProfile.version,
    });

    if (run) {
      await markDigestRunFinished(run.id, {
        status: result.skipped ? "skipped" : "success",
        error: result.skipped ? result.reason : null,
        metadata: result.skipped
          ? undefined
          : {
              digestId: result.digestId,
              selectedCount: result.selectedCount,
            },
      });
    }

    return result;
  } catch (error) {
    if (run) {
      await markDigestRunFinished(run.id, {
        status: "failed",
        error: normalizeRunError(error),
      });
    }
    throw error;
  }
}

async function generateDailyDigestForProfile(
  input: Required<Pick<GenerateDailyDigestInput, "digestDate" | "interestProfileVersion">> &
    Pick<GenerateDailyDigestInput, "maxCandidates">,
) {
  const digestDate = input.digestDate;
  let candidates = await getPersistedCandidates(digestDate);

  if (candidates.length === 0) {
    await selectDigestCandidates({ digestDate, maxCandidates: input.maxCandidates });
    candidates = await getPersistedCandidates(digestDate);
  }

  if (candidates.length === 0) {
    return { skipped: true as const, reason: "no_candidates" };
  }

  const profile = candidates[0].interestProfile;
  if (profile.version !== input.interestProfileVersion) {
    return { skipped: true as const, reason: "no_candidates" };
  }
  const config = await getChatConfig();
  const model = await chatModel();
  const promptCandidates = candidates.map((candidate) => ({
    articleId: candidate.articleId,
    title: candidate.title,
    source: candidate.feedTitle,
    publishedAt: candidate.publishedAt?.toISOString() ?? null,
    summary: candidate.aiSummary ?? candidate.summaryRaw,
    retrievalRank: candidate.retrievalRank,
    scoreSnapshot: candidate.scoreSnapshot,
  }));
  const result = await withAIRequestRetry(() =>
    generateObject({
      model,
      schema: digestSchema,
      schemaName: DAILY_DIGEST_SCHEMA_NAME,
      schemaDescription: DAILY_DIGEST_SCHEMA_DESCRIPTION,
      temperature: 0.4,
      system:
        "你是单用户 RSS x AI 阅读器的每日简报编辑。输出必须是最终每日简报对象,顶层只能使用 title、summary、items。不要输出 selectedArticles。只能从候选文章中选择，理由必须基于用户兴趣画像和候选证据。不要引入外部事实。",
      prompt: buildDailyDigestPrompt({
        digestDate,
        interestProfile: profile.content,
        candidates: promptCandidates,
      }),
      experimental_repairText: ({ text }) => repairDailyDigestText(text, promptCandidates),
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
  return getScheduleLocalDate(env.DIGEST_TIMEZONE);
}
