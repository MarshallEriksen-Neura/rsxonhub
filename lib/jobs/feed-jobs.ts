import { sql } from "drizzle-orm";
import type { Job } from "pg-boss";
import { analyzeArticle } from "@/lib/ai/article-analysis";
import { getEmbeddingConfig } from "@/lib/ai/config";
import {
  embedSingleArticle,
  rebuildArticleEmbeddings,
} from "@/lib/ai/embedding-rebuild";
import { db } from "@/lib/db";
import { articleSummaries, feeds } from "@/lib/db/schema";
import { generateDailyDigest } from "@/lib/digest/generate-digest";
import {
  attachDigestRunJob,
  createDigestRun,
  hasCompletedDigestRun,
  markDigestRunFinished,
  markDigestRunRunning,
  normalizeRunError,
} from "@/lib/digest/runs";
import { getScheduleLocalDate } from "@/lib/datetime";
import { env } from "@/lib/env";
import { getActiveInterestProfile } from "@/lib/interests/profile";
import { startBoss } from "@/lib/jobs/boss";
import {
  JOB_NAMES,
  type ArticleAnalyzeJob,
  type ArticleEmbedJob,
  type DigestGenerateDailyJob,
  type DigestPrepareDailyJob,
  type FeedFetchOneJob,
} from "@/lib/jobs/names";
import { selectDigestCandidates } from "@/lib/retrieval/hybrid-candidates";
import { ingestFeed, type IngestFeedResult } from "@/lib/rss/ingest";

export async function enqueueFeedFetch(feedId: number) {
  const boss = await startBoss();
  return boss.send(
    JOB_NAMES.feedFetchOne,
    { feedId } satisfies FeedFetchOneJob,
    {
      retryLimit: 3,
      retryBackoff: true,
      singletonKey: `feed:${feedId}`,
      singletonSeconds: 60 * 10,
    },
  );
}

export async function enqueueArticleAnalysis(articleId: number) {
  const boss = await startBoss();
  return boss.send(
    JOB_NAMES.articleAnalyze,
    { articleId } satisfies ArticleAnalyzeJob,
    {
      retryLimit: 2,
      retryBackoff: true,
      singletonKey: `article.analyze:${articleId}`,
      singletonSeconds: 60 * 30,
    },
  );
}

export async function enqueueArticleEmbedding(input: ArticleEmbedJob) {
  const boss = await startBoss();
  const singletonKey = input.rebuildRunId
    ? `embedding.rebuild:${input.rebuildRunId}`
    : `article.embed:${input.articleId}`;

  return boss.send(JOB_NAMES.articleEmbed, input, {
    retryLimit: 2,
    retryBackoff: true,
    singletonKey,
    singletonSeconds: 60 * 60,
  });
}

export type PostIngestEmbeddingResult = {
  enqueuedCount: number;
  skipped: boolean;
  error: string | null;
};

export async function enqueueChangedArticleEmbeddings(
  result: Pick<IngestFeedResult, "changedArticleIds">,
): Promise<PostIngestEmbeddingResult> {
  const articleIds = Array.from(new Set(result.changedArticleIds));
  if (articleIds.length === 0) {
    return { enqueuedCount: 0, skipped: true, error: null };
  }

  try {
    const config = await getEmbeddingConfig();
    if (!config.apiKey.trim()) {
      return {
        enqueuedCount: 0,
        skipped: true,
        error: "向量模型 API Key 未配置,已跳过后台 RAG 索引。",
      };
    }

    await Promise.all(articleIds.map((articleId) => enqueueArticleEmbedding({ articleId })));
    return { enqueuedCount: articleIds.length, skipped: false, error: null };
  } catch (error) {
    return {
      enqueuedCount: 0,
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function enqueueDailyDigest(input: DigestGenerateDailyJob = {}) {
  const boss = await startBoss();
  const digestDate = input.digestDate ?? getScheduleLocalDate(env.DIGEST_TIMEZONE);
  const profileVersion =
    input.interestProfileVersion ?? (await getActiveInterestProfile())?.version;

  if (!profileVersion) {
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
    return null;
  }

  const inFlight = await hasCompletedDigestRun({
    digestDate,
    interestProfileVersion: profileVersion,
    phase: "generate",
    statuses: ["pending", "running"],
  });
  if (inFlight) {
    return null;
  }

  const pendingRun =
    input.runId == null
      ? await createDigestRun({
          digestDate,
          interestProfileVersion: profileVersion,
          phase: "generate",
          status: "pending",
        })
      : null;

  let jobId: string | null;
  try {
    jobId = await boss.send(
      JOB_NAMES.digestGenerateDaily,
      {
        digestDate,
        interestProfileVersion: profileVersion,
        runId: input.runId ?? pendingRun?.id,
      },
      {
        retryLimit: 2,
        retryBackoff: true,
        singletonKey: `digest:${digestDate}:${profileVersion}`,
        singletonSeconds: 60 * 60 * 12,
      },
    );
  } catch (error) {
    if (pendingRun) {
      await markDigestRunFinished(pendingRun.id, {
        status: "failed",
        error: normalizeRunError(error),
      });
    }
    throw error;
  }

  if (pendingRun) {
    await attachDigestRunJob(pendingRun.id, jobId ?? null);
  }

  return jobId;
}

export async function enqueueDailyDigestPreparation(input: DigestPrepareDailyJob = {}) {
  const boss = await startBoss();
  const digestDate = input.digestDate ?? getScheduleLocalDate(env.DIGEST_TIMEZONE);
  const profileVersion =
    input.interestProfileVersion ?? (await getActiveInterestProfile())?.version;

  if (!profileVersion) {
    const alreadySkipped = await hasCompletedDigestRun({
      digestDate,
      interestProfileVersion: 0,
      phase: "prepare",
      statuses: ["skipped"],
    });
    if (!alreadySkipped) {
      await createDigestRun({
        digestDate,
        interestProfileVersion: 0,
        phase: "prepare",
        status: "skipped",
        error: "no_interest_profile",
      });
    }
    return null;
  }

  const inFlight = await hasCompletedDigestRun({
    digestDate,
    interestProfileVersion: profileVersion,
    phase: "prepare",
    statuses: ["pending", "running"],
  });
  if (inFlight) {
    return null;
  }

  const pendingRun =
    input.runId == null
      ? await createDigestRun({
          digestDate,
          interestProfileVersion: profileVersion,
          phase: "prepare",
          status: "pending",
        })
      : null;

  let jobId: string | null;
  try {
    jobId = await boss.send(
      JOB_NAMES.digestPrepareDaily,
      {
        digestDate,
        interestProfileVersion: profileVersion,
        runId: input.runId ?? pendingRun?.id,
      },
      {
        retryLimit: 1,
        retryBackoff: true,
        singletonKey: `digest.prepare:${digestDate}:${profileVersion}`,
        singletonSeconds: 60 * 30,
      },
    );
  } catch (error) {
    if (pendingRun) {
      await markDigestRunFinished(pendingRun.id, {
        status: "failed",
        error: normalizeRunError(error),
      });
    }
    throw error;
  }

  if (pendingRun) {
    await attachDigestRunJob(pendingRun.id, jobId ?? null);
  }

  return jobId;
}

export async function enqueueDueFeedScan() {
  const boss = await startBoss();
  return boss.send(
    JOB_NAMES.feedFetchDue,
    {},
    {
      singletonKey: "feed.fetch-due",
      singletonSeconds: 60,
    },
  );
}

export async function registerFeedJobs() {
  const boss = await startBoss();

  await boss.work(JOB_NAMES.feedFetchDue, async () => {
    const dueFeeds = await db
      .select({ id: feeds.id })
      .from(feeds)
      .where(
        sql`${feeds.lastFetchedAt} is null or ${feeds.lastFetchedAt} < now() - (${feeds.fetchInterval} * interval '1 second')`,
      );

    await Promise.all(dueFeeds.map((feed) => enqueueFeedFetch(feed.id)));
  });

  await boss.work<FeedFetchOneJob>(
    JOB_NAMES.feedFetchOne,
    async (jobs: Job<FeedFetchOneJob>[]) => {
      await Promise.all(
        jobs.map(async (job) => {
          const result = await ingestFeed(job.data.feedId);
          await enqueueChangedArticleEmbeddings(result);
        }),
      );
    },
  );

  await boss.work<ArticleAnalyzeJob>(
    JOB_NAMES.articleAnalyze,
    async (jobs: Job<ArticleAnalyzeJob>[]) => {
      await Promise.all(jobs.map((job) => analyzeArticle(job.data.articleId)));
    },
  );

  await boss.work<ArticleEmbedJob>(
    JOB_NAMES.articleEmbed,
    async (jobs: Job<ArticleEmbedJob>[]) => {
      const indexedArticles = await Promise.all(
        jobs.map((job) => {
          if (job.data.rebuildRunId) {
            return rebuildArticleEmbeddings(job.data.rebuildRunId).then(() => null);
          }
          if (!job.data.articleId) {
            throw new Error("article.embed requires articleId or rebuildRunId");
          }
          return embedSingleArticle(job.data.articleId).then(() => job.data.articleId ?? null);
        }),
      );
      if (indexedArticles.some((articleId) => articleId != null)) {
        await enqueueDailyDigestPreparation();
      }
    },
  );

  await boss.work<DigestPrepareDailyJob>(
    JOB_NAMES.digestPrepareDaily,
    async (jobs: Job<DigestPrepareDailyJob>[]) => {
      await Promise.all(jobs.map((job) => runDigestPreparation(job.data)));
    },
  );

  await boss.work<DigestGenerateDailyJob>(
    JOB_NAMES.digestGenerateDaily,
    async (jobs: Job<DigestGenerateDailyJob>[]) => {
      await Promise.all(jobs.map((job) => generateDailyDigest(job.data)));
    },
  );
}

export async function runDigestPreparation(input: DigestPrepareDailyJob = {}) {
  const digestDate = input.digestDate ?? getScheduleLocalDate(env.DIGEST_TIMEZONE);
  const profileVersion =
    input.interestProfileVersion ?? (await getActiveInterestProfile())?.version;

  if (!profileVersion) {
    return { skipped: true as const, reason: "no_interest_profile" };
  }

  const run =
    input.runId != null
      ? { id: input.runId }
      : await createDigestRun({
          digestDate,
          interestProfileVersion: profileVersion,
          phase: "prepare",
          status: "running",
        });

  if (input.runId != null) {
    await markDigestRunRunning(input.runId);
  }

  try {
    await enqueueDueFeedScan();
    const {
      candidateCount,
      enqueuedAnalysisCount,
    } = await enqueueAnalysisForSelectedCandidates({ digestDate });

    await markDigestRunFinished(run.id, {
      status: candidateCount > 0 ? "success" : "skipped",
      error: candidateCount > 0 ? null : "no_candidates",
      metadata: {
        candidateCount,
        enqueuedAnalysisCount,
      },
    });

    return {
      skipped: candidateCount === 0,
      reason: candidateCount === 0 ? "no_candidates" : null,
      candidateCount,
      enqueuedAnalysisCount,
    };
  } catch (error) {
    await markDigestRunFinished(run.id, {
      status: "failed",
      error: normalizeRunError(error),
    });
    throw error;
  }
}

export async function enqueueAnalysisForSelectedCandidates(input: {
  digestDate?: string;
} = {}) {
  const candidates = await selectDigestCandidates({ digestDate: input.digestDate });
  const enqueuedAnalysisCount = await enqueueAnalysisForCurrentCandidates(candidates);

  return {
    candidateCount: candidates.length,
    enqueuedAnalysisCount,
  };
}

export async function enqueueAnalysisForCurrentCandidates(
  candidates: Awaited<ReturnType<typeof selectDigestCandidates>>,
) {
  if (candidates.length === 0) return 0;

  const pending = await db
    .select({ articleId: articleSummaries.articleId })
    .from(articleSummaries)
    .where(sql`${articleSummaries.status} = 'pending'`);
  const pendingIds = new Set(pending.map((row) => row.articleId));

  let enqueued = 0;
  for (const candidate of candidates) {
    if (pendingIds.has(candidate.articleId)) continue;
    await enqueueArticleAnalysis(candidate.articleId);
    enqueued += 1;
  }

  return enqueued;
}
